export class SearchForgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "SearchForgeError";
  }
}

export class ProviderError extends SearchForgeError {
  constructor(provider: string, message: string, status = 502) {
    super(`${provider}: ${message}`, "PROVIDER_ERROR", status);
    this.name = "ProviderError";
  }
}
