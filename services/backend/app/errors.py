class DomainError(Exception):
    def __init__(self, code: str, status: int = 409, retryable: bool = False):
        self.code, self.status, self.retryable = code, status, retryable
        super().__init__(code)
