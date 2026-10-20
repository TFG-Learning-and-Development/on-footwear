type ScormApi = {
  LMSInitialize(value: string): string;
  LMSFinish(value: string): string;
  LMSGetValue(element: string): string;
  LMSSetValue(element: string, value: string): string;
  LMSCommit(value: string): string;
  LMSGetLastError(): string;
  LMSGetErrorString(code: string): string;
  LMSGetDiagnostic(code: string): string;
};

type ApiWindow = Window & { API?: ScormApi };

const findApi = (): ScormApi | null => {
  const visited = new Set<Window>();
  for (const startingWindow of [window, window.opener]) {
    let current = startingWindow;
    for (let depth = 0; current && depth < 20 && !visited.has(current); depth += 1) {
      visited.add(current);
      try {
        if ((current as ApiWindow).API) return (current as ApiWindow).API!;
        if (current === current.parent) break;
        current = current.parent;
      } catch { break; }
    }
  }
  return null;
};

export type ScormLaunch = { mode: "standalone" | "lms" | "failed"; status: string; suspendData: string };

export class ScormSession {
  private api = findApi();
  private active = false;
  private ready = false;
  private finished = false;
  private status = "";

  private failure(operation: string, detail = "") {
    let code = "unknown";
    let message = "";
    let diagnostic = "";
    try {
      code = this.api?.LMSGetLastError() || code;
      message = this.api?.LMSGetErrorString(code) || "";
      diagnostic = this.api?.LMSGetDiagnostic(code) || "";
    } catch (error) { diagnostic = String(error); }
    console.error(`[scorm] ${operation} failed${detail ? ` (${detail})` : ""}: ${code} ${message} ${diagnostic}`.trim());
  }

  private call(operation: "LMSInitialize" | "LMSFinish" | "LMSCommit" | "LMSSetValue", value: string, element?: string): boolean {
    if (!this.api) return false;
    try {
      const result = operation === "LMSSetValue" ? this.api.LMSSetValue(element!, value) : this.api[operation](value);
      if (result === "true") return true;
      this.failure(operation, element);
    } catch (error) { this.failure(operation, `${element || ""} ${String(error)}`); }
    return false;
  }

  private get(element: string): string | null {
    if (!this.api) return null;
    try {
      const value = this.api.LMSGetValue(element);
      const error = this.api.LMSGetLastError();
      if (error === "0") return value;
      this.failure("LMSGetValue", element);
    } catch (error) { this.failure("LMSGetValue", `${element} ${String(error)}`); }
    return null;
  }

  launch(): ScormLaunch {
    if (!this.api) return { mode: "standalone", status: "", suspendData: "" };
    if (!this.call("LMSInitialize", "")) return { mode: "failed", status: "", suspendData: "" };
    this.active = true;
    const status = this.get("cmi.core.lesson_status");
    const suspendData = this.get("cmi.suspend_data");
    if (status === null || suspendData === null) return { mode: "failed", status: "", suspendData: "" };
    this.ready = true;
    this.status = status;
    if (["", "not attempted", "browsed"].includes(status)) {
      if (this.call("LMSSetValue", "incomplete", "cmi.core.lesson_status") && this.call("LMSCommit", "")) this.status = "incomplete";
    }
    return { mode: "lms", status: this.status, suspendData };
  }

  save(suspendData: string, allRequiredComplete: boolean): void {
    if (!this.active || !this.ready || this.finished) return;
    let suspendSaved = false;
    if (suspendData.length > 4096) {
      console.error(`[scorm] cmi.suspend_data is ${suspendData.length} characters; SCORM 1.2 permits 4096. Progress was not sent to the LMS.`);
    } else {
      suspendSaved = this.call("LMSSetValue", suspendData, "cmi.suspend_data");
    }
    const needsCompletion = allRequiredComplete && !["completed", "passed"].includes(this.status);
    const completionWritten = needsCompletion && this.call("LMSSetValue", "completed", "cmi.core.lesson_status");
    if (suspendSaved || completionWritten) {
      const committed = this.call("LMSCommit", "");
      if (committed && completionWritten) this.status = "completed";
    }
  }

  exit(suspendData: string, allRequiredComplete: boolean): void {
    if (!this.active || this.finished) return;
    if (this.ready) {
      this.save(suspendData, allRequiredComplete);
      this.call("LMSSetValue", "suspend", "cmi.core.exit");
      this.call("LMSCommit", "");
    }
    this.finished = true;
    this.call("LMSFinish", "");
  }
}
