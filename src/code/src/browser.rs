use anyhow::{Result, anyhow};
use headless_chrome::{Browser, LaunchOptions, Tab};
use std::sync::Arc;
use std::time::Duration;

pub struct BrowserEngine {
    _browser: Browser,
    tab: Arc<Tab>,
}

impl BrowserEngine {
    pub fn new(headless: bool) -> Result<Self> {
        let launch_options = LaunchOptions {
            headless,
            window_size: Some((1280, 800)),
            ..Default::default()
        };

        let browser =
            Browser::new(launch_options).map_err(|e| anyhow!("Failed to launch browser: {}", e))?;

        let tab = browser
            .new_tab()
            .map_err(|e| anyhow!("Failed to open new tab: {}", e))?;

        Ok(Self {
            _browser: browser,
            tab,
        })
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
