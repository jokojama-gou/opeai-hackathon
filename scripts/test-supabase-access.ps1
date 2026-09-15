[CmdletBinding()]
param(
    [ValidatePattern('^[a-z]{20}$')]
    [string]$ProjectRef = 'nmidnmqnrhogehzehkjh'
)
$ErrorActionPreference = 'Stop'
$api = Join-Path $PSScriptRoot 'supabase-api.ps1'
$base = "/v1/projects/$ProjectRef"
$results = [Collections.Generic.List[object]]::new()
function Check([string]$Name, [scriptblock]$Action) {
    try {
        $detail = & $Action
        $results.Add([pscustomobject]@{ test = $Name; status = 'PASS'; detail = "$detail" })
    } catch {
        $results.Add([pscustomobject]@{ test = $Name; status = 'FAIL'; detail = $_.Exception.Message })
    }
}
function Query([string]$Sql) {
    $bodyPath = [IO.Path]::GetTempFileName()
    try {
        @{ query = $Sql } | ConvertTo-Json | Set-Content -LiteralPath $bodyPath -Encoding utf8
        & $api -Method POST -Path "$base/database/query" -BodyFile $bodyPath
    } finally { Remove-Item -LiteralPath $bodyPath -Force }
}
Check 'Project read' {
    $p = & $api -Path $base
    if ($p.id -ne $ProjectRef) { throw 'Unexpected project.' }
    "status=$($p.status)"
}
foreach ($endpoint in @('config/auth', 'config/storage', 'config/realtime', 'postgrest', 'functions')) {
    Check "GET $endpoint" {
        $null = & $api -Path "$base/$endpoint"
        'Request succeeded; response content not logged.'
    }
}
Check 'TypeScript generation' {
    $r = & $api -Path "$base/types/typescript?included_schemas=public"
    if (-not $r.types -or $r.types -notmatch 'Database') { throw 'Expected generated Database type.' }
    "Generated characters=$($r.types.Length)"
}
Check 'SQL read' {
    $r = Query 'select 1 as connection_ok;'
    if ($r.connection_ok -ne 1) { throw 'SQL result mismatch.' }
    'SELECT 1 returned expected value.'
}
$schema = 'codex_access_test_' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
Check 'DDL, CRUD, index and RLS policy creation (rolled back)' {
    $sql = @'
BEGIN;
SET LOCAL statement_timeout = '10s';
CREATE SCHEMA __SCHEMA__;
CREATE TABLE __SCHEMA__.probe (id integer PRIMARY KEY, value text NOT NULL);
INSERT INTO __SCHEMA__.probe VALUES (1, 'before');
DO $test$ BEGIN
 IF (SELECT value FROM __SCHEMA__.probe WHERE id=1) IS DISTINCT FROM 'before' THEN
  RAISE EXCEPTION 'Insert/read mismatch'; END IF;
END $test$;
UPDATE __SCHEMA__.probe SET value='after' WHERE id=1;
DO $test$ BEGIN
 IF (SELECT value FROM __SCHEMA__.probe WHERE id=1) IS DISTINCT FROM 'after' THEN
  RAISE EXCEPTION 'Update mismatch'; END IF;
END $test$;
CREATE INDEX probe_value_idx ON __SCHEMA__.probe(value);
ALTER TABLE __SCHEMA__.probe ENABLE ROW LEVEL SECURITY;
CREATE POLICY probe_deny ON __SCHEMA__.probe FOR SELECT USING (false);
DO $test$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='__SCHEMA__' AND policyname='probe_deny') THEN
  RAISE EXCEPTION 'Policy missing'; END IF;
END $test$;
DELETE FROM __SCHEMA__.probe WHERE id=1;
DO $test$ BEGIN
 IF EXISTS (SELECT 1 FROM __SCHEMA__.probe) THEN RAISE EXCEPTION 'Delete mismatch'; END IF;
END $test$;
DROP TABLE __SCHEMA__.probe;
DROP SCHEMA __SCHEMA__;
ROLLBACK;
'@
    $null = Query ($sql.Replace('__SCHEMA__', $schema))
    'All SQL assertions succeeded; transaction rolled back.'
}
Check 'No test schema remains' {
    $r = Query "select count(*)::int as remaining from pg_namespace where nspname='$schema';"
    if ($r.remaining -ne 0) { throw "Test schema remains: $schema" }
    'remaining=0'
}
$results | ConvertTo-Json -Depth 3
if (@($results | Where-Object status -eq 'FAIL').Count) { exit 1 }
