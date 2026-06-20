// Shared HTTP transport. Uses the Android native bridge (window.Android.get/post
// with named callbacks) when present, falling back to XMLHttpRequest on Tizen/web.
// Mirrors the bero-movies bridge; adds header support for Bearer auth.
export abstract class AbstractClient {
  private callbackCounter = 0;

  protected get<T>(url: string, headers?: Record<string, string>) {
    return this.fetch<T>(url, "", "GET", headers);
  }

  protected post<T>(url: string, data: any, headers?: Record<string, string>) {
    const body = typeof data === "string" ? data : JSON.stringify(data);
    return this.fetch<T>(url, body, "POST", headers);
  }

  private fetch<T>(
    url: string,
    body = "",
    method = "GET",
    headers: Record<string, string> = {}
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const ok = (text: string) => {
        try {
          resolve(text ? (JSON.parse(text) as T) : (undefined as any));
        } catch (e) {
          reject(e);
        }
      };

      if (window["Android"] && Android.getWithHeaders) {
        // Native bridge path. Headers are passed as a JSON string.
        const cbName = "cb" + this.callbackCounter;
        const errName = "cberr" + this.callbackCounter;
        this.callbackCounter++;
        window[cbName] = (r: string) => ok(r);
        window[errName] = (err: any) => reject(err);
        const headerJson = JSON.stringify(headers || {});
        if (method === "POST") Android.postWithHeaders(url, body, headerJson, cbName, errName);
        else Android.getWithHeaders(url, headerJson, cbName, errName);
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader("Accept", "application/json");
      if (method === "POST" && !headers["Content-Type"]) {
        xhr.setRequestHeader("Content-Type", "application/json");
      }
      Object.keys(headers).forEach((k) => xhr.setRequestHeader(k, headers[k]));
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) ok(xhr.responseText);
        else reject({ status: xhr.status, body: xhr.responseText });
      };
      xhr.send(method === "POST" ? body : undefined);
    });
  }
}
