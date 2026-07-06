use crate::browser::BrowserEngine;
use crate::ollama_agent::OllamaAgent;
use anyhow::{Result, anyhow};
use chrono::Utc;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Debug, Deserialize)]
pub struct PromptwareAction {
    pub action: String,
    pub url: Option<String>,
    pub selector: Option<String>,
    pub text: Option<String>,
    pub submit: Option<bool>,
    pub ms: Option<u64>,
    pub reason: Option<String>,
    pub reflection: Option<String>,
    pub reflection_title: Option<String>,
}

pub fn find_promptwares_dir() -> PathBuf {
    if let Ok(dir) = std::env::current_dir() {
        let p = dir.join("src").join("promptwares");
        if p.exists() {
            return p;
        }
        let p2 = dir.join("promptwares");
        if p2.exists() {
            return p2;
        }
        if let Some(parent) = dir.parent() {
            let p3 = parent.join("promptwares");
            if p3.exists() {
                return p3;
            }
            let p4 = parent.join("src").join("promptwares");
            if p4.exists() {
                return p4;
            }
        }
    }
    PathBuf::from("/Users/rorychatt/git/rorychatt/blueberry-browser/src/promptwares")
}

pub fn read_memory(promptware_name: &str, filename: &str) -> Result<String> {
    let promptwares_dir = find_promptwares_dir();
    let memory_dir = promptwares_dir.join(promptware_name).join("memory");
    let file_path = memory_dir.join(filename);

    if !file_path.exists() {
        // Try capital Memory
        let alt_path = promptwares_dir
            .join(promptware_name)
            .join("Memory")
            .join(filename);
        if alt_path.exists() {
            return fs::read_to_string(alt_path)
                .map_err(|e| anyhow!("Failed to read memory file: {}", e));
        }
        return Err(anyhow!(
            "Memory file '{}' not found in promptware '{}'",
            filename,
            promptware_name
        ));
    }

    fs::read_to_string(file_path).map_err(|e| anyhow!("Failed to read memory file: {}", e))
}

pub fn write_memory(promptware_name: &str, filename: &str, content: &str) -> Result<()> {
    let promptwares_dir = find_promptwares_dir();
    let memory_dir = promptwares_dir.join(promptware_name).join("memory");
    fs::create_dir_all(&memory_dir)
        .map_err(|e| anyhow!("Failed to create memory directory: {}", e))?;

    let file_path = memory_dir.join(filename);
    fs::write(&file_path, content).map_err(|e| anyhow!("Failed to write memory file: {}", e))?;

    Ok(())
}

pub fn save_reflection_memory(
    promptware_name: &str,
    title_or_prompt: &str,
    full_ref_content: &str,
    core_reflection: &str,
) -> Result<String> {
    let mut slug = String::new();
    for c in title_or_prompt.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('_') && !slug.is_empty() {
            slug.push('_');
        }
    }
    if slug.ends_with('_') {
        slug.pop();
    }
    slug.truncate(50);
    if slug.ends_with('_') {
        slug.pop();
    }
    if slug.is_empty() {
        slug.push_str("reflection");
    }

    let filename = format!("{}.md", slug);

    let promptwares_dir = find_promptwares_dir();
    let memory_dir = promptwares_dir.join(promptware_name).join("memory");
    fs::create_dir_all(&memory_dir)
        .map_err(|e| anyhow!("Failed to create memory directory: {}", e))?;

    let file_path = memory_dir.join(&filename);

    let mut existing_content = String::new();
    if file_path.exists() {
        existing_content = fs::read_to_string(&file_path)
            .map_err(|e| anyhow!("Failed to read memory file: {}", e))?;
    }

    if !existing_content.is_empty() {
        if existing_content.contains(core_reflection.trim()) {
            return Ok(filename);
        }
        let updated_content = format!(
            "{}\n\n---\n\n{}\n",
            existing_content.trim(),
            full_ref_content.trim()
        );
        fs::write(&file_path, updated_content)
            .map_err(|e| anyhow!("Failed to write memory file: {}", e))?;
    } else {
        fs::write(&file_path, format!("{}\n", full_ref_content.trim()))
            .map_err(|e| anyhow!("Failed to write memory file: {}", e))?;
    }

    Ok(filename)
}

pub fn write_log(promptware_name: &str, job_id: &str, content: &str) -> Result<()> {
    let promptwares_dir = find_promptwares_dir();
    let logs_dir = promptwares_dir.join(promptware_name).join("logs");
    fs::create_dir_all(&logs_dir).map_err(|e| anyhow!("Failed to create logs directory: {}", e))?;

    let file_path = logs_dir.join(format!("{}.md", job_id));
    fs::write(&file_path, content).map_err(|e| anyhow!("Failed to write log file: {}", e))?;

    Ok(())
}

pub fn compile_prompt_system_and_user(
    promptware_name: &str,
    values: &HashMap<String, String>,
) -> Result<(String, String)> {
    let promptwares_dir = find_promptwares_dir();
    let folder = promptwares_dir.join(promptware_name);

    // Try system_prompt.md, fallback to Program.md
    let mut system_md_path = folder.join("system_prompt.md");
    if !system_md_path.exists() {
        system_md_path = folder.join("Program.md");
    }

    if !system_md_path.exists() {
        return Err(anyhow!(
            "Neither system_prompt.md nor Program.md found at {:?}",
            folder
        ));
    }

    let system_instructions = fs::read_to_string(&system_md_path)
        .map_err(|e| anyhow!("Failed to read system instructions file: {}", e))?;

    // Load Memory files
    let mut memory_files = Vec::new();
    let mut memory_contents = String::new();

    let memory_dir = folder.join("memory");
    let memory_dir_alt = folder.join("Memory");
    let active_memory_dir = if memory_dir.exists() {
        Some(memory_dir)
    } else if memory_dir_alt.exists() {
        Some(memory_dir_alt)
    } else {
        None
    };

    if let Some(dir) = active_memory_dir {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
                    if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                        if filename != ".gitkeep" {
                            memory_files.push(filename.to_string());
                            if let Ok(content) = fs::read_to_string(&path) {
                                memory_contents.push_str(&format!(
                                    "### File: {}\n\n{}\n\n---\n\n",
                                    filename, content
                                ));
                            }
                        }
                    }
                }
            }
        }
    }

    let memory_files_listing = if memory_files.is_empty() {
        "(no memory files yet)".to_string()
    } else {
        memory_files.join(", ")
    };

    let memory_contents_section = if memory_contents.is_empty() {
        "(no accumulated memories yet)".to_string()
    } else {
        memory_contents
    };

    let system_prompt = format!(
        r#"You are an agentic application that evolves over time.

This prompt is your Firmware and is never allowed to change.

Your program folder is: {:?}

## Goal

Your goal is to complete the instructions in the **System Instructions** section below with the following priority:

1. Completeness
2. Speed
3. Token efficiency
4. Improvement over time

**Memory Files:**
{}

**Accumulated Memories / Reflections:**
{}

To read a memory file offline:
Use the CLI command: `blueberry-core promptware-read-memory {} <filename>.md`

Complete your task and return the appropriate output.

## Reflection

Every execution needs to end with a reflection step. This is your opportunity to improve over time. What did we learn during this session?
When you return your final JSON response, provide a `reflection` field containing your key takeaways, lessons, or rules learned. This will be automatically written to a memory file for you.

## System Instructions

{}
"#,
        folder, memory_files_listing, memory_contents_section, promptware_name, system_instructions
    );

    // Now load user prompt
    let user_md_path = folder.join("user_prompt.md");
    let user_prompt = if user_md_path.exists() {
        let user_template = fs::read_to_string(&user_md_path)
            .map_err(|e| anyhow!("Failed to read user_prompt.md: {}", e))?;

        let mut compiled_user = user_template;
        for (key, val) in values {
            compiled_user = compiled_user.replace(&format!("{{{{{}}}}}", key), val);
        }
        compiled_user
    } else {
        // Fallback to default user prompt format using values HashMap
        let mut headers = values.clone();
        if !headers.contains_key("CurrentTime") {
            headers.insert("CurrentTime".to_string(), Utc::now().to_rfc3339());
        }

        let mut header_keys: Vec<&String> = headers.keys().collect();
        header_keys.sort();

        let mut header_str = String::new();
        for key in header_keys {
            if let Some(val) = headers.get(key) {
                header_str.push_str(&format!("{}: {}\n", key, val));
            }
        }

        format!("---\n{}---", header_str)
    };

    Ok((system_prompt, user_prompt))
}

pub fn compile_prompt(promptware_name: &str, values: &HashMap<String, String>) -> Result<String> {
    let (system, user) = compile_prompt_system_and_user(promptware_name, values)?;
    Ok(format!("{}\n\n{}", system, user))
}

fn clean_json_response(output: &str) -> &str {
    let mut text = output.trim();
    if text.starts_with("```json") {
        text = text.strip_prefix("```json").unwrap_or(text);
        text = text.strip_suffix("```").unwrap_or(text);
    } else if text.starts_with("```") {
        text = text.strip_prefix("```").unwrap_or(text);
        text = text.strip_suffix("```").unwrap_or(text);
    }
    text.trim()
}

pub async fn run_e2e_loop(
    browser: &BrowserEngine,
    agent: &OllamaAgent,
    test_prompt: &str,
) -> Result<()> {
    let start_time = Instant::now();
    let job_id = format!("job_{}", Utc::now().format("%Y%m%d_%H%M%S"));
    println!("🤖 Promptware Agent running E2ETest (Job ID: {})", job_id);
    println!("🎯 Target Goal: '{}'", test_prompt);
    println!("--------------------------------------------------");

    let mut step_num = 1;
    let mut accumulated_log = format!(
        "# E2ETest Promptware Job Log ({})\n\n- **Target Goal**: {}\n- **Started At**: {}\n\n## Steps\n\n",
        job_id,
        test_prompt,
        Utc::now().to_rfc3339()
    );

    loop {
        if step_num > 20 {
            let err_msg =
                "Execution stopped: exceeded maximum steps limit of 20 to prevent infinite loop.";
            accumulated_log.push_str(&format!(
                "\n### ❌ Execution Stopped\n\nError: {}\n",
                err_msg
            ));
            let _ = write_log("E2ETest", &job_id, &accumulated_log);
            return Err(anyhow!(err_msg));
        }

        let step_start = Instant::now();
        println!("  [Step {}] Reading page context...", step_num);

        let current_url_val = browser.run_js("window.location.href").await?;
        let current_url = current_url_val
            .as_str()
            .unwrap_or("about:blank")
            .to_string();

        let page_text = match browser.get_text().await {
            Ok(text) => text,
            Err(_) => "".to_string(),
        };

        // Truncate page text context to 5000 characters to keep it extremely fast and lightweight
        let page_text_truncated = if page_text.len() > 5000 {
            format!(
                "{}... (truncated, total length: {} characters)",
                &page_text[0..5000],
                page_text.len()
            )
        } else {
            page_text.clone()
        };

        let mut values = HashMap::new();
        values.insert("Prompt".to_string(), test_prompt.to_string());
        values.insert("CurrentUrl".to_string(), current_url.clone());
        values.insert("PageContent".to_string(), page_text_truncated);
        values.insert("ConsoleLogs".to_string(), "[]".to_string());
        values.insert("NetworkEvents".to_string(), "[]".to_string());

        let (system_prompt, user_prompt) = compile_prompt_system_and_user("E2ETest", &values)?;

        println!(
            "  [Step {}] Evaluating next action using local Ollama model...",
            step_num
        );
        let response_raw = agent
            .generate_with_system(&system_prompt, &user_prompt)
            .await?;
        let cleaned_json = clean_json_response(&response_raw);

        let action: PromptwareAction = match serde_json::from_str(cleaned_json) {
            Ok(act) => act,
            Err(e) => {
                println!(
                    "  [Step {}] ❌ Failed to parse JSON response from LLM!",
                    step_num
                );
                println!("     Raw Output:\n---\n{}\n---", response_raw);
                accumulated_log.push_str(&format!(
                    "### Step {}\n- **Current URL**: {}\n- **Error**: Failed to parse JSON response: {}\n- **Raw Model Response**:\n```\n{}\n```\n\n",
                    step_num, current_url, e, response_raw
                ));
                let _ = write_log("E2ETest", &job_id, &accumulated_log);
                return Err(anyhow!(
                    "Failed to parse action JSON: {}. Model output: '{}'",
                    e,
                    cleaned_json
                ));
            }
        };

        let action_name = action.action.to_lowercase();
        let reason = action
            .reason
            .clone()
            .unwrap_or_else(|| "No reason provided.".to_string());
        println!(
            "  [Step {}] Action decided: '{}' (reason: '{}')",
            step_num, action_name, reason
        );

        accumulated_log.push_str(&format!(
            "### Step {}\n- **Current URL**: {}\n- **Action**: `{}`\n- **Reason**: {}\n- **Elapsed**: {:?}\n\n",
            step_num, current_url, action_name, reason, step_start.elapsed()
        ));

        // If a reflection/learning was generated, let's write it to memory!
        if let Some(ref_content) = &action.reflection {
            if !ref_content.trim().is_empty() {
                let reflection_title = action
                    .reflection_title
                    .as_deref()
                    .unwrap_or(test_prompt);
                let full_ref_content = format!(
                    "# Reflection - Step {}\n\n- **Prompt**: {}\n- **Action**: {}\n- **Reason**: {}\n- **Reflection/Learning**:\n{}\n",
                    step_num, test_prompt, action_name, reason, ref_content
                );
                match save_reflection_memory("E2ETest", reflection_title, &full_ref_content, ref_content) {
                    Ok(filename) => {
                        println!(
                            "  [Step {}] 💡 Saved learning reflection to memory: {}",
                            step_num, filename
                        );
                        accumulated_log.push_str(&format!("- **💡 Learning Saved**: {}\n\n", filename));
                    }
                    Err(e) => {
                        eprintln!("  [Step {}] ⚠️ Failed to save reflection: {}", step_num, e);
                    }
                }
            }
        }

        match action_name.as_str() {
            "navigate" => {
                let url = action
                    .url
                    .ok_or_else(|| anyhow!("Action 'navigate' requires a 'url' field"))?;
                println!("  [Step {}] 🌐 Navigating to '{}'...", step_num, url);
                browser.navigate(&url).await?;
            }
            "click" => {
                let selector = action
                    .selector
                    .ok_or_else(|| anyhow!("Action 'click' requires a 'selector' field"))?;
                println!(
                    "  [Step {}] 🖱️ Clicking element '{}'...",
                    step_num, selector
                );
                browser.click(&selector).await?;
            }
            "type" => {
                let selector = action
                    .selector
                    .ok_or_else(|| anyhow!("Action 'type' requires a 'selector' field"))?;
                let text = action
                    .text
                    .ok_or_else(|| anyhow!("Action 'type' requires a 'text' field"))?;
                let submit = action.submit.unwrap_or(false);
                println!(
                    "  [Step {}] ⌨️ Typing '{}' into '{}'{}...",
                    step_num, text, selector, if submit { " and submitting" } else { "" }
                );
                browser.type_text(&selector, &text, submit).await?;
            }
            "wait" => {
                let ms = action.ms.unwrap_or(1000);
                println!("  [Step {}] ⏱️ Waiting {}ms...", step_num, ms);
                browser.wait(ms).await?;
            }
            "wait_for" => {
                let selector = action
                    .selector
                    .ok_or_else(|| anyhow!("Action 'wait_for' requires a 'selector' field"))?;
                println!(
                    "  [Step {}] 🔍 Waiting for element '{}'...",
                    step_num, selector
                );
                browser.wait_for_element(&selector, 10000).await?;
            }
            "screenshot" => {
                let path = action
                    .selector
                    .or(action.text)
                    .unwrap_or_else(|| "tests/screenshot.png".to_string());
                println!(
                    "  [Step {}] 📸 Taking screenshot saved to '{}'...",
                    step_num, path
                );
                browser.screenshot(&path).await?;
            }
            "complete" => {
                println!("--------------------------------------------------");
                println!(
                    "🎉 Promptware E2ETest Goal ACHIEVED in {:?}",
                    start_time.elapsed()
                );
                accumulated_log.push_str(&format!(
                    "\n## 🎉 Goal Achieved Successfully\n\nPassed in {:?}",
                    start_time.elapsed()
                ));
                let _ = write_log("E2ETest", &job_id, &accumulated_log);
                return Ok(());
            }
            "fail" => {
                println!("--------------------------------------------------");
                println!("❌ Promptware E2ETest Goal FAILED: {}", reason);
                accumulated_log.push_str(&format!("\n## ❌ Goal Failed\n\nReason: {}\n", reason));
                let _ = write_log("E2ETest", &job_id, &accumulated_log);
                return Err(anyhow!(
                    "Goal declared as failed by agent. Reason: {}",
                    reason
                ));
            }
            _ => {
                let err_msg = format!("Unknown action: '{}'", action_name);
                accumulated_log.push_str(&format!("- **Error**: {}\n\n", err_msg));
                let _ = write_log("E2ETest", &job_id, &accumulated_log);
                return Err(anyhow!(err_msg));
            }
        }

        step_num += 1;
        println!();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn cleanup(name: &str) {
        let test_dir = find_promptwares_dir().join(name);
        if test_dir.exists() {
            let _ = fs::remove_dir_all(&test_dir);
        }
    }

    #[test]
    fn test_write_and_read_memory() {
        let test_name = "__test_promptware_memory_cli__";
        cleanup(test_name);

        let filename = "test_memory.md";
        let content = "# Test Memory Content\nThis is a test of promptware memory.";

        // Write memory
        let write_res = write_memory(test_name, filename, content);
        assert!(write_res.is_ok(), "Failed to write memory");

        // Verify the file was actually created in the correct location
        let promptwares_dir = find_promptwares_dir();
        let expected_path = promptwares_dir
            .join(test_name)
            .join("memory")
            .join(filename);
        assert!(
            expected_path.exists(),
            "Memory file was not created on disk"
        );

        // Read memory back
        let read_res = read_memory(test_name, filename);
        assert!(read_res.is_ok(), "Failed to read memory");
        assert_eq!(read_res.unwrap(), content);

        cleanup(test_name);
    }

    #[test]
    fn test_write_log() {
        let test_name = "__test_promptware_log_cli__";
        cleanup(test_name);

        let job_id = "test_job_123456";
        let content = "# E2ETest Promptware Test Log\n- Step 1: Ok";

        // Write log
        let write_res = write_log(test_name, job_id, content);
        assert!(write_res.is_ok(), "Failed to write log");

        // Verify the log file was actually created on disk
        let promptwares_dir = find_promptwares_dir();
        let expected_path = promptwares_dir
            .join(test_name)
            .join("logs")
            .join(format!("{}.md", job_id));
        assert!(expected_path.exists(), "Log file was not created on disk");

        // Verify log contents are correct
        let read_content =
            fs::read_to_string(&expected_path).expect("Failed to read log file back");
        assert_eq!(read_content, content);

        cleanup(test_name);
    }

    #[test]
    fn test_compile_prompt_system_and_user() {
        let test_name = "__test_promptware_compile_cli__";
        cleanup(test_name);

        let promptwares_dir = find_promptwares_dir();
        let folder = promptwares_dir.join(test_name);
        fs::create_dir_all(&folder).expect("Failed to create test folder");

        // Write mock system_prompt.md and user_prompt.md
        let system_prompt_content =
            "This is a custom system instruction. Let's do this: {{Prompt}}";
        let user_prompt_content = "Please perform: {{Prompt}} at {{CurrentUrl}}";

        fs::write(folder.join("system_prompt.md"), system_prompt_content)
            .expect("Failed to write system prompt");
        fs::write(folder.join("user_prompt.md"), user_prompt_content)
            .expect("Failed to write user prompt");

        let mut values = HashMap::new();
        values.insert("Prompt".to_string(), "Click Submit".to_string());
        values.insert("CurrentUrl".to_string(), "https://example.com".to_string());

        let compile_res = compile_prompt_system_and_user(test_name, &values);
        assert!(compile_res.is_ok(), "Failed to compile prompt");

        let (system_compiled, user_compiled) = compile_res.unwrap();

        // System prompt contains the file list and accumulated memories sections, plus system_instructions
        assert!(system_compiled.contains("This is a custom system instruction."));
        // User prompt has replaced template variables
        assert_eq!(
            user_compiled,
            "Please perform: Click Submit at https://example.com"
        );

        cleanup(test_name);
    }

    #[test]
    fn test_save_reflection_memory() {
        let test_name = "__test_promptware_save_ref_cli__";
        cleanup(test_name);

        let title = "Search Results evaluation";
        let ref_content = "# Reflection\n- Action: Click\n- Detail: Succesful";
        let core = "- Detail: Succesful";

        // 1. Save new reflection
        let res = save_reflection_memory(test_name, title, ref_content, core);
        assert!(res.is_ok());
        let filename = res.unwrap();
        assert_eq!(filename, "search_results_evaluation.md");

        // Verify content on disk
        let promptwares_dir = find_promptwares_dir();
        let expected_path = promptwares_dir
            .join(test_name)
            .join("memory")
            .join(&filename);
        assert!(expected_path.exists());
        let content_on_disk = fs::read_to_string(&expected_path).unwrap();
        assert!(content_on_disk.contains("- Detail: Succesful"));

        // 2. Try saving identical core reflection (should not duplicate)
        let res2 = save_reflection_memory(test_name, title, ref_content, core);
        assert!(res2.is_ok());
        let content_on_disk2 = fs::read_to_string(&expected_path).unwrap();
        // Count matches of "- Detail: Succesful" should be 1
        let matches = content_on_disk2.matches("- Detail: Succesful").count();
        assert_eq!(matches, 1);

        // 3. Save a different reflection to same file (should append)
        let new_ref_content = "# Reflection 2\n- Action: Type\n- Detail: Typed successfully";
        let new_core = "- Detail: Typed successfully";
        let res3 = save_reflection_memory(test_name, title, new_ref_content, new_core);
        assert!(res3.is_ok());
        let content_on_disk3 = fs::read_to_string(&expected_path).unwrap();
        assert!(content_on_disk3.contains("- Detail: Succesful"));
        assert!(content_on_disk3.contains("- Detail: Typed successfully"));
        assert!(content_on_disk3.contains("---"));

        cleanup(test_name);
    }
}
