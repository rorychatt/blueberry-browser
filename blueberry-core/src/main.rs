mod browser;
mod ollama_agent;
mod yaml_parser;

use anyhow::{anyhow, Result};
use browser::BrowserEngine;
use clap::{Parser, Subcommand};
use ollama_agent::OllamaAgent;
use std::time::Instant;
use yaml_parser::{TestSuite, TestStep};

#[derive(Parser)]
#[command(name = "blueberry")]
#[command(about = "Blueberry Playwright - Modern AI-Native E2E Test Runner", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run a YAML-defined end-to-end test suite
    Run {
        /// Path to the YAML test file
        file: String,

        /// Run browser in headful mode (visible window)
        #[arg(long, default_value_t = false)]
        headful: bool,
    },
    /// Ask local Ollama agent to evaluate the active webpage (requires running server or active browser)
    Agent {
        /// Goal or assertion prompt for the agent
        prompt: String,
        /// File containing webpage text context
        #[arg(short, long)]
        context_file: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Run { file, headful } => {
            println!("🚀 Loading test suite from: {}", file);
            let suite = TestSuite::load_from_file(&file)?;
            println!("📋 Test Suite Name: '{}'", suite.name);
            println!("--------------------------------------------------");

            let headless = !headful;
            let browser = BrowserEngine::new(headless)?;
            let agent = OllamaAgent::new();

            let suite_start = Instant::now();
            let mut failed = false;

            for (index, step) in suite.steps.iter().enumerate() {
                let step_num = index + 1;
                let step_start = Instant::now();

                match step {
                    TestStep::Navigate(url) => {
                        print!("  [{}] Navigate to '{}'... ", step_num, url);
                        match browser.navigate(url).await {
                            Ok(_) => println!("✓ ({:?})", step_start.elapsed()),
                            Err(e) => {
                                println!("✗ Failed!");
                                println!("     Error: {}", e);
                                failed = true;
                                break;
                            }
                        }
                    }
                    TestStep::Click(selector) => {
                        print!("  [{}] Click element '{}'... ", step_num, selector);
                        match browser.click(selector).await {
                            Ok(_) => println!("✓ ({:?})", step_start.elapsed()),
                            Err(e) => {
                                println!("✗ Failed!");
                                println!("     Error: {}", e);
                                failed = true;
                                break;
                            }
                        }
                    }
                    TestStep::Type(type_step) => {
                        print!(
                            "  [{}] Type '{}' into '{}'... ",
                            step_num, type_step.text, type_step.selector
                        );
                        match browser.type_text(&type_step.selector, &type_step.text).await {
                            Ok(_) => println!("✓ ({:?})", step_start.elapsed()),
                            Err(e) => {
                                println!("✗ Failed!");
                                println!("     Error: {}", e);
                                failed = true;
                                break;
                            }
                        }
                    }
                    TestStep::Wait(ms) => {
                        print!("  [{}] Wait {}ms... ", step_num, ms);
                        browser.wait(*ms).await?;
                        println!("✓ ({:?})", step_start.elapsed());
                    }
                    TestStep::WaitFor(selector) => {
                        print!("  [{}] Wait for element '{}' to exist... ", step_num, selector);
                        match browser.wait_for_element(selector, 10000).await {
                            Ok(_) => println!("✓ ({:?})", step_start.elapsed()),
                            Err(e) => {
                                println!("✗ Failed!");
                                println!("     Error: {}", e);
                                failed = true;
                                break;
                            }
                        }
                    }
                    TestStep::Screenshot(path) => {
                        print!("  [{}] Take screenshot saved to '{}'... ", step_num, path);
                        match browser.screenshot(path).await {
                            Ok(_) => println!("✓ ({:?})", step_start.elapsed()),
                            Err(e) => {
                                println!("✗ Failed!");
                                println!("     Error: {}", e);
                                failed = true;
                                break;
                            }
                        }
                    }
                    TestStep::Agent(prompt) => {
                        print!("  [{}] Local Ollama Agent evaluation: '{}'... ", step_num, prompt);
                        
                        // Capture text content
                        let text_content = match browser.get_text().await {
                            Ok(text) => text,
                            Err(e) => {
                                println!("✗ Failed!");
                                println!("     Error retrieving page text: {}", e);
                                failed = true;
                                break;
                            }
                        };

                        match agent.assert(prompt, &text_content).await {
                            Ok(response) => {
                                if response.success {
                                    println!("✓ ({:?})", step_start.elapsed());
                                    println!("     AI Reason: {}", response.reason);
                                } else {
                                    println!("✗ Failed!");
                                    println!("     AI Assertion Failed: {}", response.reason);
                                    failed = true;
                                    break;
                                }
                            }
                            Err(e) => {
                                println!("✗ Failed!");
                                println!("     AI Execution Error: {}", e);
                                failed = true;
                                break;
                            }
                        }
                    }
                }
            }

            println!("--------------------------------------------------");
            if failed {
                println!("❌ Test Suite '{}' FAILED in {:?}", suite.name, suite_start.elapsed());
                std::process::exit(1);
            } else {
                println!("🎉 Test Suite '{}' PASSED successfully in {:?}", suite.name, suite_start.elapsed());
            }
        }
        Commands::Agent { prompt, context_file } => {
            println!("🤖 Offline Agent Assertion Engine");
            let context = match context_file {
                Some(file) => std::fs::read_to_string(file)?,
                None => return Err(anyhow!("Context file must be provided in manual agent execution mode.")),
            };

            let agent = OllamaAgent::new();
            match agent.assert(&prompt, &context).await {
                Ok(resp) => {
                    println!("Status: {}", if resp.success { "PASSED" } else { "FAILED" });
                    println!("Reason: {}", resp.reason);
                }
                Err(e) => println!("Error: {}", e),
            }
        }
    }

    Ok(())
}
