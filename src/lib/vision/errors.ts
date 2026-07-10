/**
 * Specific error types a VisionProvider can throw, so callers (currently
 * just scanStickerBacksAction) can map them to a specific, useful Hebrew
 * message instead of a single generic fallback - see
 * toUserFacingScanError() in src/lib/actions/scanner.ts.
 */

/** The provider's HTTP request itself failed or returned a non-2xx status. Never includes the API key. */
export class VisionApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "VisionApiError";
    this.status = status;
  }
}

/** The provider's request took too long and was aborted client-side (see VISION_TIMEOUT_MS). */
export class VisionTimeoutError extends Error {
  constructor(message = "Vision provider request timed out") {
    super(message);
    this.name = "VisionTimeoutError";
  }
}

/** The provider responded, but its content couldn't be parsed as the expected JSON shape. */
export class VisionParseError extends Error {
  constructor(message = "Could not parse Vision provider response") {
    super(message);
    this.name = "VisionParseError";
  }
}
