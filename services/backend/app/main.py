from typing import Annotated
from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool
from .adapters import MediaProbe, SupabaseAuth, SupabaseBlobs
from .config import Settings
from .errors import DomainError
from .models import (
    Correction,
    Login,
    Mutation,
    RecordingCreate,
    Refresh,
    Transcription,
    UploadTicket,
)
from .service import Service, identifier
from .reviews import ReviewService
from .openai_generation import OpenAIGeneration
from .derived_contracts import (
    PersonalContext,
    CandidateView,
    TodoView,
    RunView,
    DailyView,
    TodayView,
    ReviewPreferences,
)
from .derived_models import (
    RunCreate,
    TimeZoneEdit,
    DailyCreate,
    CandidateEdit,
    Adopt,
    TodoEdit,
    Reconfirm,
)
from .models import ConnectionCreate, ConnectionAccept, MatchConfirmation, ShareResponse
from .models import SavedCreate, SavedEdit, SavedDelete
from .store import PostgresStore


def build_service(settings=None):
    settings = settings or Settings.from_env()
    if not settings.configured:
        return None
    return ReviewService(
        PostgresStore(settings.database_url),
        SupabaseBlobs(
            settings.supabase_url,
            settings.supabase_service_key,
            settings.storage_bucket,
        ),
        settings,
        MediaProbe(),
        generation=OpenAIGeneration.from_options(settings.generation_options),
    )


def create_app(service=None, auth=None, settings=None):
    settings = settings or Settings.from_env()
    service = service or build_service(settings)
    auth = auth or (
        SupabaseAuth(settings.supabase_url, settings.supabase_anon_key)
        if settings.configured
        else None
    )
    api = FastAPI(title="Conversation MVP API", version="0.1.0")
    if settings.cors_origins:
        api.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=[
                "Authorization",
                "Content-Type",
                "X-Upload-Ticket",
                "X-Audio-Checksum",
            ],
            allow_credentials=False,
        )

    @api.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @api.exception_handler(DomainError)
    async def domain_error(_request, error):
        return JSONResponse(
            {
                "code": error.code,
                "retryable": error.retryable,
                "request_id": identifier(),
            },
            status_code=error.status,
        )

    @api.exception_handler(RequestValidationError)
    async def invalid_request(_request, _error):
        # Pydantic's default error body may echo submitted private text/passwords.
        return JSONResponse(
            {"code": "invalid_request", "retryable": False, "request_id": identifier()},
            status_code=422,
        )

    def configured():
        if service is None or auth is None:
            raise DomainError("backend_not_configured", 503)
        return service

    def actor(authorization: Annotated[str | None, Header()] = None):
        configured()
        if not authorization or not authorization.startswith("Bearer "):
            raise DomainError("unauthenticated", 401)
        return auth.actor(authorization[7:])

    Actor = Annotated[str, Depends(actor)]

    @api.get("/health")
    def health():
        return {
            "status": "ok",
            "configured": service is not None,
            "asr_configured": bool(
                service and service.policy()["transcription_configured"]
            ),
        }

    @api.post("/v1/session")
    def session(payload: Login):
        configured()
        return auth.session(payload.model_dump())

    @api.post("/v1/session/refresh")
    def refresh(payload: Refresh):
        configured()
        return auth.session(payload.model_dump(), refresh=True)

    @api.get("/v1/processing-policy")
    def policy(user: Actor):
        return service.policy()

    @api.get("/v1/recordings")
    def recordings(user: Actor):
        return service.list_recordings(user)

    @api.post("/v1/recordings", status_code=201)
    def create_recording(payload: RecordingCreate, user: Actor):
        return service.create_recording(user, payload.model_dump())

    @api.get("/v1/recordings/{rid}")
    def get_recording(rid: str, user: Actor):
        return service.get_recording(user, rid)

    @api.get("/v1/recordings/{rid}/sources")
    def sources(rid: str, user: Actor):
        return service.sources(user, rid)

    @api.post("/v1/recordings/{rid}/uploads", status_code=201)
    def ticket(rid: str, payload: UploadTicket, user: Actor):
        return service.ticket(user, rid, payload.model_dump())

    @api.put("/v1/recordings/{rid}/audio")
    async def upload(
        rid: str,
        request: Request,
        user: Actor,
        x_upload_ticket: Annotated[str, Header()],
        x_audio_checksum: Annotated[str, Header()],
    ):
        # Authenticate and verify ownership/configuration/ticket BEFORE consuming request.stream().
        def gate():
            with service.store.transaction() as state:
                record = service.check_upload(
                    state, user, rid, x_upload_ticket, x_audio_checksum
                )
                return record["size"]

        limit = await run_in_threadpool(gate)
        audio = bytearray()
        async for chunk in request.stream():
            audio.extend(chunk)
            if len(audio) > min(limit, 26214400):
                raise DomainError("audio_too_large", 422)
        return await run_in_threadpool(
            service.upload, user, rid, x_upload_ticket, x_audio_checksum, bytes(audio)
        )

    @api.post("/v1/recordings/{rid}/transcription-jobs", status_code=202)
    def transcription(rid: str, payload: Transcription, user: Actor):
        return service.transcription(user, rid, payload.model_dump())

    @api.get("/v1/jobs/{job_id}")
    def job(job_id: str, user: Actor):
        return service.job(user, job_id)

    @api.post("/v1/sources/{source_id}/corrections", status_code=201)
    def correction(source_id: str, payload: Correction, user: Actor):
        return service.correct(user, source_id, payload.model_dump())

    @api.delete("/v1/recordings/{rid}", status_code=202)
    def delete_recording(rid: str, payload: Mutation, user: Actor):
        return service.delete_recording(user, rid, payload.model_dump())

    @api.get("/v1/recordings/{rid}/audio")
    def audio(rid: str, user: Actor):
        return Response(service.read_audio(user, rid), media_type="audio/mp4")

    @api.post("/v1/connections", status_code=201)
    def create_connection(payload: ConnectionCreate, user: Actor):
        return service.create_connection(user, payload.model_dump())

    @api.post("/v1/connections/accept")
    def accept_connection(payload: ConnectionAccept, user: Actor):
        result = service.accept_connection(user, payload.model_dump())
        return service.connections(user, result["connection_id"])

    @api.get("/v1/connections")
    def connections(user: Actor):
        return service.connections(user)

    @api.get("/v1/connections/{cid}")
    def connection(cid: str, user: Actor):
        return service.connections(user, cid)

    @api.post("/v1/matches/{mid}/confirmations")
    def confirm_match(mid: str, payload: MatchConfirmation, user: Actor):
        result = service.confirm_match(user, mid, payload.model_dump())
        return service.connections(user, result["connection_id"])

    @api.post("/v1/share-scopes/{sid}/responses")
    def share_response(sid: str, payload: ShareResponse, user: Actor):
        result = service.share_response(user, sid, payload.model_dump())
        return service.connections(user, result["connection_id"])

    @api.post("/v1/matches/{mid}/revisions")
    def revise_match(mid: str, payload: MatchConfirmation, user: Actor):
        result = service.confirm_match(user, mid, payload.model_dump(), revising=True)
        return service.connections(user, result["connection_id"])

    @api.post("/v1/matches/{mid}/cancel")
    def cancel_match(mid: str, payload: Mutation, user: Actor):
        return service.cancel_match(user, mid, payload.model_dump())

    @api.get("/v1/continuing-grants")
    def continuing_grants(user: Actor):
        return service.continuing_grants(user)

    @api.post("/v1/continuing-grants/{gid}/revoke")
    def revoke_grant(gid: str, payload: Mutation, user: Actor):
        return service.revoke_grant(user, gid, payload.model_dump())

    @api.get("/v1/conversations")
    def conversations(user: Actor):
        return service.conversations(user)

    @api.get("/v1/conversations/{cid}")
    def conversation(cid: str, user: Actor):
        return service.conversations(user, cid)

    @api.get("/v1/conversations/{cid}/sources/{sid}")
    def shared_source(cid: str, sid: str, user: Actor):
        return service.shared_source(user, cid, sid)

    @api.post("/v1/share-scopes/{sid}/revoke")
    def revoke_scope(sid: str, payload: Mutation, user: Actor):
        return service.revoke_scope(user, sid, payload.model_dump())

    @api.post("/v1/saved-items", status_code=201)
    def save_item(payload: SavedCreate, user: Actor):
        return service.save_item(user, payload.model_dump())

    @api.get("/v1/saved-items")
    def saved_items(user: Actor):
        return service.saved_items(user)

    @api.patch("/v1/saved-items/{sid}")
    def edit_saved(sid: str, payload: SavedEdit, user: Actor):
        return service.edit_saved(user, sid, payload.model_dump())

    @api.post("/v1/saved-items/{sid}/rebind")
    def rebind_saved(sid: str, payload: SavedCreate, user: Actor):
        return service.rebind_saved(user, sid, payload.model_dump())

    @api.delete("/v1/saved-items/{sid}")
    def delete_saved(sid: str, payload: SavedDelete, user: Actor):
        return service.delete_saved(user, sid, payload.model_dump())

    @api.get("/v1/preferences", response_model=ReviewPreferences)
    def preferences(user: Actor):
        return service.preferences(user)

    @api.patch("/v1/preferences/review-time-zone")
    def edit_zone(payload: TimeZoneEdit, user: Actor):
        return service.edit_zone(user, payload.model_dump())

    @api.get(
        "/v1/contexts",
        response_model=list[PersonalContext],
        response_model_exclude_unset=True,
    )
    def contexts(user: Actor):
        return service.contexts(user)

    @api.get(
        "/v1/contexts/{cid}",
        response_model=PersonalContext,
        response_model_exclude_unset=True,
    )
    def context(cid: str, user: Actor):
        return service.context(user, cid)

    @api.get("/v1/contexts/{cid}/evidence")
    def context_evidence(cid: str, source_id: str, version: int, user: Actor):
        return service.context_evidence(user, cid, source_id, version)

    @api.post("/v1/contexts/{cid}/agent-runs", status_code=202)
    def create_run(cid: str, payload: RunCreate, user: Actor):
        return service.create_run(user, cid, payload.model_dump())

    @api.get(
        "/v1/agent-runs/{run_id}",
        response_model=RunView,
        response_model_exclude_unset=True,
    )
    def agent_run(run_id: str, user: Actor):
        return service.agent_run(user, run_id)

    @api.post("/v1/agent-runs/{run_id}/retry", status_code=202)
    def retry_run(run_id: str, payload: Mutation, user: Actor):
        return service.retry_run(user, run_id, payload.model_dump())

    @api.get(
        "/v1/action-candidates",
        response_model=list[CandidateView],
        response_model_exclude_unset=True,
    )
    def candidates(user: Actor):
        return service.candidates(user)

    @api.patch("/v1/action-candidates/{cid}")
    def dismiss_candidate(cid: str, payload: CandidateEdit, user: Actor):
        return service.dismiss_candidate(user, cid, payload.model_dump())

    @api.post("/v1/action-candidates/{cid}/adopt", status_code=201)
    def adopt(cid: str, payload: Adopt, user: Actor):
        return service.adopt(user, cid, payload.model_dump())

    @api.get(
        "/v1/todos", response_model=list[TodoView], response_model_exclude_unset=True
    )
    def todos(user: Actor):
        return service.todos(user)

    @api.patch("/v1/todos/{tid}")
    def edit_todo(tid: str, payload: TodoEdit, user: Actor):
        return service.edit_todo(user, tid, payload.model_dump())

    @api.delete("/v1/todos/{tid}")
    def delete_todo(tid: str, payload: Mutation, user: Actor):
        return service.edit_todo(user, tid, payload.model_dump(), deleting=True)

    @api.post("/v1/todos/{tid}/reconfirm")
    def reconfirm_todo(tid: str, payload: Reconfirm, user: Actor):
        return service.reconfirm_todo(user, tid, payload.model_dump())

    @api.get("/v1/today", response_model=TodayView, response_model_exclude_unset=True)
    def today(date: str, zone: str, user: Actor):
        return service.today(user, date, zone)

    @api.post("/v1/daily-reviews", status_code=202)
    def create_daily(payload: DailyCreate, user: Actor):
        return service.create_daily(user, payload.model_dump())

    @api.get(
        "/v1/daily-reviews/{did}",
        response_model=DailyView,
        response_model_exclude_unset=True,
    )
    def daily(did: str, user: Actor):
        return service.daily(user, did)

    return api


app = create_app()
