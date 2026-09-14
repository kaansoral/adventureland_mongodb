//! Native script transport. No browser cookies, credentials or filesystem access.
use serde::Serialize;
use std::time::Duration;

const MAX_BYTES: usize = 10 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptResponse {
    status: u16,
    status_text: String,
    text: String,
    headers: String,
}

fn validate_url(url: &url::Url) -> Result<(), String> {
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("Script URLs must use HTTP or HTTPS".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Script URLs must not contain credentials".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_http_script(url: String) -> Result<ScriptResponse, String> {
    fetch(&url, Duration::from_secs(30), MAX_BYTES).await
}

async fn fetch(input: &str, timeout: Duration, limit: usize) -> Result<ScriptResponse, String> {
    let url = url::Url::parse(input).map_err(|_| "Invalid script URL")?;
    validate_url(&url)?;
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if let Err(error) = validate_url(attempt.url()) {
                attempt.error(error)
            } else if attempt.previous().len() > 10 {
                attempt.error("Too many script redirects")
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|error| error.to_string())?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();
    if status.is_redirection() {
        return Err("Script redirect did not resolve to an HTTP/HTTPS response".into());
    }
    let headers = response
        .headers()
        .iter()
        .filter_map(|(key, value)| {
            value
                .to_str()
                .ok()
                .map(|value| format!("{key}: {value}\r\n"))
        })
        .collect();
    // Do not expose error bodies to old jQuery's unconditional script converter.
    let mut bytes = Vec::new();
    if status.is_success() {
        if response
            .content_length()
            .is_some_and(|length| length > limit as u64)
        {
            return Err("Script exceeds response size limit".into());
        }
        while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
            if chunk.len() > limit.saturating_sub(bytes.len()) {
                return Err("Script exceeds response size limit".into());
            }
            bytes.extend_from_slice(&chunk);
        }
    }
    Ok(ScriptResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").into(),
        text: String::from_utf8(bytes).map_err(|_| "Script must be UTF-8")?,
        headers,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    fn server(response: String, delay: Duration) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buffer = [0; 4096];
            let _ = stream.read(&mut buffer);
            std::thread::sleep(delay);
            let _ = stream.write_all(response.as_bytes());
        });
        format!("http://{address}/arbitrary/path.js?test=1")
    }

    fn run(url: &str, timeout: Duration, limit: usize) -> Result<ScriptResponse, String> {
        tauri::async_runtime::block_on(fetch(url, timeout, limit))
    }

    #[test]
    fn urls_are_not_restricted_to_directories_or_local_hosts() {
        for value in [
            "http://localhost/a",
            "http://127.0.0.1:7106/b",
            "http://192.168.1.223/c",
            "http://example.com/d",
            "https://example.com/e",
        ] {
            assert!(validate_url(&value.parse().unwrap()).is_ok());
        }
        for value in [
            "file:///tmp/a",
            "ftp://example.com/a",
            "http://user:pass@example.com/a",
        ] {
            assert!(validate_url(&value.parse().unwrap()).is_err());
        }
    }

    #[test]
    fn fetches_text_and_headers_and_follows_redirects() {
        let target = server(
            "HTTP/1.1 200 OK\r\nContent-Length: 5\r\nX-Test: yes\r\n\r\nhello".into(),
            Duration::ZERO,
        );
        let redirect = server(
            format!("HTTP/1.1 302 Found\r\nLocation: {target}\r\nContent-Length: 0\r\n\r\n"),
            Duration::ZERO,
        );
        let result = run(&redirect, Duration::from_secs(2), 100).unwrap();
        assert_eq!(result.status, 200);
        assert_eq!(result.text, "hello");
        assert!(result.headers.contains("x-test: yes"));
    }

    #[test]
    fn rejects_errors_limits_timeouts_and_unsupported_redirects() {
        let url = server(
            "HTTP/1.1 404 Not Found\r\nContent-Length: 5\r\n\r\nevil!".into(),
            Duration::ZERO,
        );
        let result = run(&url, Duration::from_secs(2), 100).unwrap();
        assert_eq!(result.status, 404);
        assert!(result.text.is_empty());
        for response in [
            "HTTP/1.1 200 OK\r\nContent-Length: 5\r\n\r\nhello",
            "HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n0\r\n\r\n",
            "HTTP/1.1 302 Found\r\nLocation: file:///tmp/a\r\nContent-Length: 0\r\n\r\n",
        ] {
            let url = server(response.into(), Duration::ZERO);
            assert!(run(&url, Duration::from_secs(2), 4).is_err());
        }
        let url = server(
            "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n".into(),
            Duration::from_millis(200),
        );
        assert!(run(&url, Duration::from_millis(20), 100).is_err());
    }
    #[test]
    fn redirect_limit_allows_ten_but_not_eleven() {
        for count in [10, 11] {
            let mut url = server(
                "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n".into(),
                Duration::ZERO,
            );
            for _ in 0..count {
                url = server(
                    format!("HTTP/1.1 302 Found\r\nLocation: {url}\r\nContent-Length: 0\r\n\r\n"),
                    Duration::ZERO,
                );
            }
            assert_eq!(run(&url, Duration::from_secs(2), 100).is_ok(), count == 10);
        }
    }

    #[test]
    fn closed_port_reports_connection_failure() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/a.js", listener.local_addr().unwrap());
        drop(listener);
        assert!(run(&url, Duration::from_secs(2), 100).is_err());
    }
}
