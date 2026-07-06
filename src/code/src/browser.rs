use anyhow::{Result, anyhow};
use headless_chrome::{Browser, LaunchOptions, Tab};
use headless_chrome::protocol::cdp::types::Event;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use chrono::Utc;
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct E2EConsoleLog {
    pub level: String,
    pub message: String,
    pub line: u32,
    pub source_id: String,
    pub timestamp: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct E2ENetworkEvent {
    pub method: String,
    pub url: String,
    pub status_code: u16,
    pub timestamp: String,
}

pub struct BrowserEngine {
    _browser: Browser,
    tab: Arc<Tab>,
    console_logs: Arc<Mutex<Vec<E2EConsoleLog>>>,
    network_events: Arc<Mutex<Vec<E2ENetworkEvent>>>,
}

impl BrowserEngine {
    pub fn new(headless: bool) -> Result<Self> {
        let args = vec![std::ffi::OsStr::new("--disable-web-security")];
        let launch_options = LaunchOptions {
            headless,
            window_size: Some((1280, 800)),
            args,
            ..Default::default()
        };

        let browser =
            Browser::new(launch_options).map_err(|e| anyhow!("Failed to launch browser: {}", e))?;

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow!("Failed to open new tab: {}", e))?;

        // Enable domains to capture console logs and network events
        tab.enable_log()?;
        tab.enable_runtime()?;
        tab.call_method(headless_chrome::protocol::cdp::Network::Enable {
            max_total_buffer_size: None,
            max_resource_buffer_size: None,
            max_post_data_size: None,
            report_direct_socket_traffic: None,
            enable_durable_messages: None,
        })?;

        let console_logs = Arc::new(Mutex::new(Vec::new()));
        let network_events = Arc::new(Mutex::new(Vec::new()));

        let console_logs_clone = Arc::clone(&console_logs);
        let network_events_clone = Arc::clone(&network_events);

        tab.add_event_listener(Arc::new(move |event: &Event| {
            match event {
                Event::RuntimeConsoleAPICalled(params) => {
                    let level = format!("{:?}", params.params.Type).to_lowercase();
                    let message = params.params.args.iter()
                        .map(|arg| {
                            arg.value.as_ref()
                                .map(|v| {
                                    if let serde_json::Value::String(s) = v {
                                        s.clone()
                                    } else {
                                        v.to_string()
                                    }
                                })
                                .unwrap_or_default()
                        })
                        .collect::<Vec<String>>()
                        .join(" ");

                    let timestamp = Utc::now().to_rfc3339();
                    let mut logs = console_logs_clone.lock().unwrap();
                    logs.push(E2EConsoleLog {
                        level,
                        message,
                        line: 0,
                        source_id: "unknown".to_string(),
                        timestamp,
                    });
                }
                Event::NetworkResponseReceived(params) => {
                    let url = params.params.response.url.clone();
                    let status_code = params.params.response.status as u16;
                    let timestamp = Utc::now().to_rfc3339();

                    let mut events = network_events_clone.lock().unwrap();
                    events.push(E2ENetworkEvent {
                        method: "GET".to_string(),
                        url,
                        status_code,
                        timestamp,
                    });
                }
                _ => {}
            }
        }))?;

        Ok(Self {
            _browser: browser,
            tab,
            console_logs,
            network_events,
        })
    }

    pub fn get_console_logs_json(&self) -> String {
        let logs = self.console_logs.lock().unwrap();
        serde_json::to_string_pretty(&*logs).unwrap_or_else(|_| "[]".to_string())
    }

    pub fn get_network_events_json(&self) -> String {
        let events = self.network_events.lock().unwrap();
        serde_json::to_string_pretty(&*events).unwrap_or_else(|_| "[]".to_string())
    }

    pub async fn navigate(&self, url: &str) -> Result<()> {
        self.tab
            .navigate_to(url)
            .map_err(|e| anyhow!("Failed to navigate to {}: {}", url, e))?;

        self.tab
            .wait_until_navigated()
            .map_err(|e| anyhow!("Navigation timeout / wait failed for {}: {}", url, e))?;

        // Give any dynamic client-side scripts a brief moment to settle
        tokio::time::sleep(Duration::from_millis(500)).await;
        Ok(())
    }

    pub async fn click(&self, selector: &str) -> Result<()> {
        let element = self
            .tab
            .wait_for_element(selector)
            .map_err(|e| anyhow!("Element '{}' not found: {}", selector, e))?;

        element
            .click()
            .map_err(|e| anyhow!("Failed to click element '{}': {}", selector, e))?;

        Ok(())
    }

    pub async fn type_text(&self, selector: &str, text: &str, submit: bool) -> Result<()> {
        let element = self
            .tab
            .wait_for_element(selector)
            .map_err(|e| anyhow!("Element '{}' not found: {}", selector, e))?;

        // Clear existing input before typing if possible
        let _ = self
            .run_js(&format!(
                "const el = document.querySelector('{}'); if (el) el.value = '';",
                selector.replace('\'', "\\'")
            ))
            .await;

        element
            .type_into(text)
            .map_err(|e| anyhow!("Failed to type into element '{}': {}", selector, e))?;

        if submit {
            let submit_js = format!(
                r#"(() => {{
                    const el = document.querySelector('{}');
                    if (el) {{
                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        const form = el.form || el.closest("form");
                        if (form) {{
                            form.requestSubmit();
                        }} else {{
                            const enterEvent = new KeyboardEvent("keydown", {{
                                key: "Enter",
                                code: "Enter",
                                keyCode: 13,
                                which: 13,
                                bubbles: true,
                                cancelable: true
                            }});
                            el.dispatchEvent(enterEvent);
                        }}
                    }}
                }})()"#,
                selector.replace('\'', "\\'")
            );
            let _ = self.run_js(&submit_js).await;
        }

        Ok(())
    }

    pub async fn wait(&self, ms: u64) -> Result<()> {
        tokio::time::sleep(Duration::from_millis(ms)).await;
        Ok(())
    }

    pub async fn wait_for_element(&self, selector: &str, ms_timeout: u64) -> Result<()> {
        // Repeatedly poll for element existence or use wait_for_element
        let start = std::time::Instant::now();
        loop {
            if self.tab.wait_for_element(selector).is_ok() {
                return Ok(());
            }
            if start.elapsed().as_millis() > ms_timeout as u128 {
                return Err(anyhow!(
                    "Timeout waiting for element '{}' to exist",
                    selector
                ));
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    pub async fn screenshot(&self, filepath: &str) -> Result<()> {
        let png_data = self
            .tab
            .capture_screenshot(
                headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Png,
                None,
                None,
                true,
            )
            .map_err(|e| anyhow!("Failed to capture screenshot: {}", e))?;

        std::fs::write(filepath, png_data)
            .map_err(|e| anyhow!("Failed to save screenshot to '{}': {}", filepath, e))?;

        Ok(())
    }

    pub async fn run_js(&self, code: &str) -> Result<serde_json::Value> {
        let remote_obj = self
            .tab
            .evaluate(code, false)
            .map_err(|e| anyhow!("JavaScript evaluation failed: {}", e))?;

        let val = remote_obj.value.unwrap_or(serde_json::Value::Null);
        Ok(val)
    }

    #[allow(dead_code)]
    pub async fn get_html(&self) -> Result<String> {
        let html_val = self.run_js("document.documentElement.outerHTML").await?;
        match html_val {
            serde_json::Value::String(s) => Ok(s),
            _ => Err(anyhow!("Failed to convert document outerHTML to string")),
        }
    }

    pub async fn get_text(&self) -> Result<String> {
        let text_val = self
            .run_js("document.body.innerText || document.documentElement.innerText")
            .await?;
        match text_val {
            serde_json::Value::String(s) => Ok(s),
            _ => Err(anyhow!("Failed to convert document innerText to string")),
        }
    }
}
