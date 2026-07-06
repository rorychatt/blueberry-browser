import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import {
  ArrowUp,
  Plus,
  Compass,
  Globe,
  MousePointerClick,
  Keyboard,
  ArrowUpDown,
  Clock,
  ArrowLeft,
  ArrowRight,
  XCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Brain,
  RefreshCw,
} from "lucide-react";
import { VoiceRecorder, type VoiceStatus } from "./voice-recorder";
import type { Message } from "../contexts/ChatContext";
import { useChat } from "../contexts/ChatContext";
import { cn } from "@common/lib/utils";
import { Button } from "@common/components/Button";

// Timeline Card Component
const TimelineCard: React.FC<{
  title: React.ReactNode;
  subtitle?: string;
  status: "running" | "success" | "error" | "info";
  icon: React.ReactNode;
  message?: React.ReactNode;
  isCollapsible?: boolean;
}> = ({ title, subtitle, status, icon, message, isCollapsible = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetails = !!message;

  return (
    <div
      className={cn(
        "relative w-full rounded-xl border p-3.5 backdrop-blur-sm shadow-sm transition-all duration-300 animate-fade-in my-1",
        status === "running" &&
          "bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/20 dark:border-blue-500/30 ring-1 ring-blue-500/10",
        status === "success" &&
          "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 dark:border-emerald-500/30 shadow-emerald-500/5",
        status === "error" &&
          "bg-destructive/5 dark:bg-destructive/10 border-destructive/20 dark:border-destructive/30 shadow-destructive/5",
        status === "info" &&
          "bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-500/20 dark:border-indigo-500/30 shadow-indigo-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left Side: Icon & Title */}
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex items-center justify-center size-8 rounded-lg border",
              status === "running" &&
                "bg-blue-500/10 border-blue-500/20 animate-pulse text-blue-500",
              status === "success" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
              status === "error" && "bg-destructive/10 border-destructive/20 text-destructive",
              status === "info" && "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
            )}
          >
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-tight text-foreground">{title}</span>
              {status === "success" && (
                <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />
              )}
              {status === "error" && <span className="size-1.5 bg-destructive rounded-full" />}
            </div>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right Side: Badges & Expand Button */}
        <div className="flex items-center gap-2">
          {status === "success" && (
            <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-[10px] font-bold text-emerald-500">
              <CheckCircle2 className="size-3" />
              SUCCESS
            </span>
          )}
          {status === "error" && (
            <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-destructive/15 border border-destructive/20 text-[10px] font-bold text-destructive">
              <XCircle className="size-3" />
              FAILED
            </span>
          )}
          {status === "info" && (
            <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-[10px] font-bold text-indigo-500">
              INFO
            </span>
          )}

          {hasDetails && isCollapsible && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="size-7 rounded-md flex items-center justify-center border border-border/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title={isOpen ? "Hide details" : "Show details"}
            >
              {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Details Block */}
      {hasDetails && (!isCollapsible || isOpen) && (
        <div className="mt-2.5 pt-2.5 border-t border-border/40 animate-fade-in">
          {typeof message === "string" ? (
            <div className="text-[11px] font-mono bg-muted/50 dark:bg-muted/10 border border-border/20 rounded-lg p-2.5 text-muted-foreground break-words leading-relaxed max-h-[180px] overflow-y-auto">
              {message}
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">{message}</div>
          )}
        </div>
      )}
    </div>
  );
};

// User Message Component - appears on the right
const UserMessage: React.FC<{ content: string }> = ({ content }) => (
  <div className="relative max-w-[85%] ml-auto animate-fade-in">
    <div className="bg-secondary text-secondary-foreground rounded-lg px-5 py-3 shadow-sm border border-primary/10">
      <div className="text-sm font-medium" style={{ whiteSpace: "pre-wrap" }}>
        {content}
      </div>
    </div>
  </div>
);

// Streaming Text Component
const StreamingText: React.FC<{ content: string }> = ({ content }) => {
  const [displayedContent, setDisplayedContent] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= content.length) {
      return;
    }
    const timer = setTimeout(() => {
      setDisplayedContent(content.slice(0, currentIndex + 1));
      setCurrentIndex(currentIndex + 1);
    }, 10);
    return () => {
      clearTimeout(timer);
    };
  }, [content, currentIndex]);

  return (
    <div className="whitespace-pre-wrap text-foreground">
      {displayedContent}
      {currentIndex < content.length && (
        <span className="inline-block w-2 h-5 bg-primary/60 dark:bg-primary/40 ml-0.5 animate-pulse" />
      )}
    </div>
  );
};

const CustomCode: React.FC<React.ComponentProps<"code">> = ({ className, children, ...props }) => {
  const inline = !className;
  return inline ? (
    <code
      className="bg-muted dark:bg-muted/50 px-1 py-0.5 rounded text-sm text-foreground"
      {...props}
    >
      {children}
    </code>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const CustomLink: React.FC<React.ComponentProps<"a">> = ({ children, href }) => (
  <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

const markdownComponents = {
  code: CustomCode,
  a: CustomLink,
};

// Markdown Renderer Component
const Markdown: React.FC<{ content: string }> = ({ content }) => (
  <div
    className="prose prose-sm dark:prose-invert max-w-none 
                    prose-headings:text-foreground prose-p:text-foreground 
                    prose-strong:text-foreground prose-ul:text-foreground 
                    prose-ol:text-foreground prose-li:text-foreground
                    prose-a:text-primary hover:prose-a:underline
                    prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 
                    prose-code:rounded prose-code:text-sm prose-code:text-foreground
                    prose-pre:bg-muted dark:prose-pre:bg-muted/50 prose-pre:p-3 
                    prose-pre:rounded-lg prose-pre:overflow-x-auto"
  >
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  </div>
);

const getActionIcon = (action: string) => {
  switch (action) {
    case "open_tab":
      return <Compass className="size-4 text-sky-500 animate-spin-slow" />;
    case "close_tab":
      return <XCircle className="size-4 text-rose-500" />;
    case "switch_tab":
      return <Compass className="size-4 text-violet-500" />;
    case "navigate":
      return <Globe className="size-4 text-teal-500 animate-pulse" />;
    case "click":
      return <MousePointerClick className="size-4 text-amber-500" />;
    case "type":
      return <Keyboard className="size-4 text-indigo-500" />;
    case "scroll_to":
      return <ArrowUpDown className="size-4 text-emerald-500" />;
    case "wait":
      return <Clock className="size-4 text-orange-400" />;
    case "go_back":
      return <ArrowLeft className="size-4 text-purple-500" />;
    case "go_forward":
      return <ArrowRight className="size-4 text-purple-500" />;
    default:
      return <Compass className="size-4 text-primary" />;
  }
};

// Parsed Step Interface for thinking and action sequences
interface ParsedStep {
  id: string;
  type: "thinking" | "tool_execution" | "page_state" | "error" | "text_response";
  content: string;
  toolAction?: string;
  toolStatus?: "running" | "success" | "error";
  toolMessage?: string;
  isStreaming?: boolean;
}

// Parse assistant message into structural steps
const parseAssistantMessage = (msg: Message): ParsedStep[] => {
  const trimmed = msg.content.trim();

  // Check if content is a tool log
  const toolRegex =
    /^⚙️ \*\*Executing Browser Action:\*\* `([^`]+)`\.\.\.(?:\n(✅ \*Success:\*|❌ \*Error:\*)([\s\S]*))?$/;
  const match = trimmed.match(toolRegex);

  if (match) {
    const actionName = match[1];
    const statusIndicator = match[2]; // "✅ *Success:*" or "❌ *Error:*" or undefined
    const detailMessage = match[3] ? match[3].trim() : "";

    let status: "running" | "success" | "error" = "running";
    if (statusIndicator === "✅ *Success:*") status = "success";
    if (statusIndicator === "❌ *Error:*") status = "error";

    return [
      {
        id: msg.id || `tool-${Date.now()}-${Math.random()}`,
        type: "tool_execution",
        content: msg.content,
        toolAction: actionName,
        toolStatus: status,
        toolMessage: detailMessage,
        isStreaming: msg.isStreaming,
      },
    ];
  }

  // Check if content is a page state update
  if (trimmed.startsWith("🔄")) {
    return [
      {
        id: msg.id || `state-${Date.now()}-${Math.random()}`,
        type: "page_state",
        content: trimmed.replace(/^🔄\s*/, "").replace(/^\*|\*$/g, ""),
        isStreaming: msg.isStreaming,
      },
    ];
  }

  // Check if content is an action block parsing/execution failure
  if (trimmed.startsWith("❌ **Failed to parse/execute action block:**")) {
    return [
      {
        id: msg.id || `err-${Date.now()}-${Math.random()}`,
        type: "error",
        content: trimmed.replace(/^❌\s*\*\*Failed to parse\/execute action block:\*\*\s*/, ""),
        isStreaming: msg.isStreaming,
      },
    ];
  }

  // Parse `<think>` tags
  const thinkStartTag = "<think>";
  const thinkEndTag = "</think>";

  // Handle prefix of <think> while it's still streaming the tag itself
  if (trimmed.length > 0 && thinkStartTag.startsWith(trimmed)) {
    return [
      {
        id: (msg.id || "") + "-think-init",
        type: "thinking",
        content: "",
        isStreaming: true,
      },
    ];
  }

  const content = msg.content;
  const startIndex = content.indexOf(thinkStartTag);
  if (startIndex !== -1) {
    const steps: ParsedStep[] = [];
    const preThinkText = content.slice(0, startIndex).trim();
    if (preThinkText) {
      steps.push({
        id: (msg.id || "") + "-pre",
        type: "text_response",
        content: preThinkText,
      });
    }

    const contentAfterStart = content.slice(startIndex + thinkStartTag.length);
    const endIndex = contentAfterStart.indexOf(thinkEndTag);

    if (endIndex === -1) {
      // Still thinking
      steps.push({
        id: (msg.id || "") + "-think",
        type: "thinking",
        content: contentAfterStart,
        isStreaming: true,
      });
    } else {
      // Completed thinking
      const thinkingContent = contentAfterStart.slice(0, endIndex);
      steps.push({
        id: (msg.id || "") + "-think",
        type: "thinking",
        content: thinkingContent,
        isStreaming: false,
      });

      const mainContent = contentAfterStart.slice(endIndex + thinkEndTag.length).trim();
      if (mainContent) {
        steps.push({
          id: (msg.id || "") + "-response",
          type: "text_response",
          content: mainContent,
          isStreaming: msg.isStreaming,
        });
      }
    }
    return steps;
  }

  return [
    {
      id: msg.id || `text-${Date.now()}-${Math.random()}`,
      type: "text_response",
      content: msg.content,
      isStreaming: msg.isStreaming,
    },
  ];
};

// Thinking Process Component - expandable, glassmorphic card for AI reasoning
const ThinkingProcessCard: React.FC<{
  steps: ParsedStep[];
  isComplete: boolean;
}> = ({ steps, isComplete }) => {
  const activeStep = steps.find((s) => s.isStreaming);
  let subtitle = `${steps.length} step${steps.length === 1 ? "" : "s"} completed`;
  if (!isComplete) {
    if (activeStep) {
      if (activeStep.type === "tool_execution") {
        subtitle = `Executing browser action: ${activeStep.toolAction}...`;
      } else if (activeStep.type === "thinking") {
        subtitle = "Formulating next browser interaction...";
      } else {
        subtitle = "Analyzing page context...";
      }
    } else {
      subtitle = "Processing agent loop...";
    }
  }

  const detailsNode = (
    <div className="relative pl-5 ml-2.5 border-l border-border/60 dark:border-border/20 flex flex-col gap-2.5 py-1">
      {steps.map((step, idx) => {
        let stepIcon = <Brain className="size-3.5" />;
        let stepTitle: React.ReactNode = "Step";
        let stepSubtitle: string | undefined;
        let stepStatus: "running" | "success" | "error" | "info" = "success";
        let stepMessage: React.ReactNode | undefined;

        if (step.type === "thinking") {
          stepIcon = <Brain className="size-3.5" />;
          stepTitle = "Reasoning";
          stepStatus = step.isStreaming ? "running" : "info";
          stepMessage = <Markdown content={step.content} />;
        } else if (step.type === "tool_execution") {
          stepIcon = getActionIcon(step.toolAction || "");
          stepTitle = (
            <span className="font-mono bg-muted px-1 py-0.5 rounded border border-border/40 text-[10px]">
              {step.toolAction}
            </span>
          );
          stepSubtitle =
            step.toolStatus === "running"
              ? "Executing browser action..."
              : step.toolStatus === "success"
                ? "Executed successfully"
                : "Execution failed";
          stepStatus = step.toolStatus || "running";
          if (step.toolMessage) {
            stepMessage = step.toolMessage;
          }
        } else if (step.type === "page_state") {
          stepIcon = <RefreshCw className="size-3.5 text-emerald-500 animate-spin-slow" />;
          stepTitle = "Page State Updated";
          stepSubtitle = "Rerunning agent loop...";
          stepStatus = "success";
          stepMessage = step.content;
        } else if (step.type === "error") {
          stepIcon = <XCircle className="size-3.5" />;
          stepTitle = "Execution Failed";
          stepSubtitle = "Action Block Parsing Error";
          stepStatus = "error";
          stepMessage = step.content;
        } else if (step.type === "text_response") {
          stepIcon = (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-3.5 text-indigo-500"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          );
          stepTitle = "Explanation";
          stepStatus = "info";
          stepMessage = <Markdown content={step.content} />;
        }

        return (
          <div key={step.id || idx} className="relative animate-fade-in group">
            {/* Timeline node dot */}
            <div
              className={cn(
                "absolute -left-[25px] size-2 rounded-full border border-background z-10 transition-all duration-300",
                stepStatus === "running" && "bg-blue-500 ring-2 ring-blue-500/20 animate-pulse",
                stepStatus === "success" && "bg-emerald-500",
                stepStatus === "error" && "bg-destructive",
                stepStatus === "info" && "bg-indigo-500",
                "top-[5px]",
              )}
            />
            {/* Content block */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex items-center justify-center size-5 rounded border",
                    stepStatus === "running" &&
                      "bg-blue-500/10 border-blue-500/20 text-blue-500 animate-pulse",
                    stepStatus === "success" &&
                      "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
                    stepStatus === "error" &&
                      "bg-destructive/10 border-destructive/20 text-destructive",
                    stepStatus === "info" &&
                      "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
                  )}
                >
                  {stepIcon}
                </div>
                <span className="text-[11px] font-bold tracking-tight text-foreground/90">
                  {stepTitle}
                </span>
                {stepSubtitle && (
                  <span className="text-[9px] text-muted-foreground font-semibold">
                    {stepSubtitle}
                  </span>
                )}
              </div>
              {stepMessage && (
                <div className="text-[10px] text-muted-foreground/90 leading-relaxed max-w-full overflow-x-auto whitespace-pre-wrap font-sans pl-6">
                  {stepMessage}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <TimelineCard
      title={isComplete ? "Thought Process" : "Thinking Process..."}
      subtitle={subtitle}
      status={isComplete ? "info" : "running"}
      icon={<Brain className="size-4" />}
      message={detailsNode}
      isCollapsible={true}
    />
  );
};

const LOADING_PHASES = [
  "Thinking...",
  "Tinkering...",
  "Analyzing active tab...",
  "Gleaning page structure...",
  "Evaluating DOM tree...",
  "Formulating browser strategy...",
  "Mapping interactive elements...",
  "Parsing accessible nodes...",
  "Drafting automation steps...",
  "Reading page context...",
  "Synthesizing visual layout...",
  "Inspecting stylesheet targets...",
  "Refining click targets...",
  "Composing input parameters...",
  "Locating main content container...",
  "Cross-referencing element positions...",
  "Identifying input fields...",
  "Interpreting navigation state...",
  "Verifying scroll boundaries...",
  "Scanning for dynamic popups...",
  "Checking network idle state...",
  "Decoding tab metadata...",
  "Evaluating javascript execution context...",
  "Optimizing locator queries...",
  "Calculating target coordinates...",
  "Resolving CSS selectors...",
  "Assessing accessibility labels...",
  "Reconstructing user flow...",
  "Predicting next page state...",
  "Measuring viewport bounds...",
  "Drafting reasoning paths...",
  "Synthesizing visual assets...",
  "Querying internal state...",
  "Compiling action block payload...",
  "Double-checking navigation history...",
  "Tracing interactive flow...",
  "Validating form fields...",
  "Aligning with user objective...",
  "Filtering noise from page source...",
  "Correlating DOM attributes...",
  "Structuring automation payload...",
  "Simulating potential actions...",
  "Detecting framework-specific components...",
  "Establishing execution context...",
  "Verifying tab connectivity...",
  "Inspecting shadow DOM trees...",
  "Mapping viewport coordinates...",
  "Constructing optimal plan...",
  "Confirming system resources...",
  "Polishing the next interaction...",
];

// Loading Indicator with spinning star
const LoadingIndicator: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setPhase((prev) => (prev + 1) % LOADING_PHASES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 dark:bg-muted/10 border border-border/20 backdrop-blur-sm shadow-sm transition-all duration-300 ease-in-out w-fit animate-fade-in",
        isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0",
      )}
    >
      <div className="relative flex items-center justify-center size-5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary/20 animate-ping opacity-75" />
        <div className="size-3.5 rounded-full bg-primary animate-pulse flex items-center justify-center">
          <span className="text-[10px]">🫐</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-muted-foreground transition-all duration-300">
        {LOADING_PHASES[phase]}
      </span>
    </div>
  );
};

const formatTime = (secs: number) => {
  const mins = Math.floor(secs / 60);
  const remaining = secs % 60;
  return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
};

// Chat Input Component with pill design
const ChatInput: React.FC<{
  onSend: (message: string) => void;
  disabled: boolean;
}> = ({ onSend, disabled }) => {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording state
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const { scrollHeight } = textareaRef.current;
      const newHeight = Math.min(scrollHeight, 200); // Max 200px
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  // Timer logic for voice recording
  useEffect(() => {
    if (voiceStatus === "recording") {
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [voiceStatus]);

  // Stop recording when component unmounts
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
        // Prevent state updates on unmounted component
        (recorderRef.current as unknown as { options: unknown }).options = {
          onStatusChange: () => {},
          onResult: () => {},
          onError: () => {},
          onVolumeChange: () => {},
        };
      }
    };
  }, []);

  const handleSubmit = () => {
    if (value.trim() && !disabled && voiceStatus === "idle") {
      onSend(value.trim());
      setValue("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "24px";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleRecording = async () => {
    if (voiceStatus === "idle") {
      setRecordError(null);
      setVolume(0);
      const recorder = new VoiceRecorder({
        endpoint: "wss://tendril-api.ivy.app/transcribe/ws",
        onStatusChange: (status) => setVoiceStatus(status),
        onResult: (transcription) => {
          console.log("[ChatInput] Transcription result received:", transcription);
          if (transcription.trim() === "") {
            setRecordError(
              "The transcription did not contain enough information. Please try again and speak clearly.",
            );
            return;
          }
          setValue((prev) => {
            const next = prev ? `${prev} ${transcription}` : transcription;
            console.log("[ChatInput] Next text state:", next);
            return next;
          });
        },
        onError: (err) => setRecordError(err),
        onVolumeChange: (vol) => setVolume(vol),
      });
      recorderRef.current = recorder;
      await recorder.start();
    } else {
      recorderRef.current?.stop();
    }
  };

  // Generate real audio level height modifications
  const barCount = 10;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const baseHeight = 4 + (i % 3) * 6; // base height between 4px and 16px
    const dynamicScale = 1 + volume * 18; // scale based on volume
    return Math.min(28, baseHeight * dynamicScale);
  });

  return (
    <div
      className={cn(
        "w-full border p-3 rounded-lg bg-background dark:bg-secondary",
        "shadow-chat animate-spring-scale outline-none transition-all duration-200",
        isFocused ? "border-primary/20 dark:border-primary/30" : "border-border",
      )}
    >
      {/* Error banner */}
      {recordError && (
        <div className="mb-2 p-2.5 rounded-md bg-destructive/15 border border-destructive/20 text-destructive text-xs flex items-center justify-between gap-2 animate-fade-in">
          <span>{recordError}</span>
          <button
            onClick={() => setRecordError(null)}
            className="font-bold hover:opacity-80 text-sm px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="w-full px-3 py-2">
        <div className="w-full flex items-start gap-3">
          <div className="relative flex-1 overflow-hidden">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
              }}
              onFocus={() => {
                setIsFocused(true);
              }}
              onBlur={() => {
                setIsFocused(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder={voiceStatus === "recording" ? "Listening..." : "Send a message..."}
              disabled={voiceStatus === "connecting" || voiceStatus === "processing"}
              className="w-full resize-none outline-none bg-transparent 
                                     text-foreground placeholder:text-muted-foreground
                                     min-h-[24px] max-h-[200px]"
              rows={1}
              style={{ lineHeight: "24px" }}
            />
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div className="w-full flex items-center gap-1.5 px-1 mt-2 mb-1">
        {/* Equalizer Waveform & Recording Timer */}
        {voiceStatus !== "idle" && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 animate-fade-in">
            <span className="size-1.5 bg-destructive rounded-full animate-ping" />
            <span className="text-[10px] font-mono font-bold text-destructive dark:text-destructive-foreground/90">
              {formatTime(duration)}
            </span>
            <div className="flex items-center gap-0.5 h-4 px-1">
              {bars.map((h, i) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className="w-0.5 bg-destructive dark:bg-destructive-foreground/90 rounded-sm transition-all duration-75"
                  style={{ height: `${(h / 28) * 16}px` }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Mic Button */}
        <button
          onClick={toggleRecording}
          disabled={disabled}
          title="Voice input"
          type="button"
          className={cn(
            "size-9 rounded-md flex items-center justify-center transition-all duration-200",
            voiceStatus === "idle" &&
              "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground",
            voiceStatus === "connecting" && "bg-secondary text-primary cursor-not-allowed",
            voiceStatus === "recording" &&
              "bg-destructive text-destructive-foreground hover:opacity-90",
            voiceStatus === "processing" && "bg-secondary text-primary cursor-not-allowed",
          )}
        >
          {voiceStatus === "connecting" || voiceStatus === "processing" ? (
            <div className="size-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          ) : voiceStatus === "recording" ? (
            <div className="size-3 bg-current rounded-sm" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-5"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3M8 22h8" />
            </svg>
          )}
        </button>

        {/* Send Button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim() || voiceStatus !== "idle"}
          className={cn(
            "size-9 rounded-md flex items-center justify-center",
            "transition-all duration-200",
            "bg-primary text-primary-foreground",
            "hover:opacity-80 disabled:opacity-50",
          )}
        >
          <ArrowUp className="size-5" />
        </button>
      </div>
    </div>
  );
};

// Message Group Interface for timeline grouping
interface MessageGroup {
  role: "user" | "assistant";
  messages: Message[];
}

// Assistant Message Group Component
const AssistantMessageGroupComponent: React.FC<{
  messages: Message[];
  isLoading?: boolean;
}> = ({ messages, isLoading }) => {
  // Parse each message in the group into a sequence of steps, then flatten them
  const steps: ParsedStep[] = [];
  messages.forEach((msg) => {
    steps.push(...parseAssistantMessage(msg));
  });

  // Separate into thinking steps and final text response
  const thinkingSteps: ParsedStep[] = [];
  let finalResponseStep: ParsedStep | null = null;

  steps.forEach((step) => {
    if (step.type === "text_response") {
      finalResponseStep = step;
    } else {
      thinkingSteps.push(step);
    }
  });

  // If there are multiple text responses, treat all but the last one as intermediate explanations
  // (which go inside the thinking timeline) to preserve correct chronological sequence
  const textResponseSteps = steps.filter((s) => s.type === "text_response");
  if (textResponseSteps.length > 1) {
    const lastTextResponse = textResponseSteps[textResponseSteps.length - 1];
    finalResponseStep = lastTextResponse;
    steps.forEach((step) => {
      if (step.type === "text_response" && step !== lastTextResponse) {
        thinkingSteps.push(step);
      }
    });
    // Ensure thinkingSteps are ordered correctly (same as original sequence)
    thinkingSteps.sort((a, b) => {
      const idxA = steps.indexOf(a);
      const idxB = steps.indexOf(b);
      return idxA - idxB;
    });
  }

  // Fallback: If agent is not loading and there's no final text response,
  // treat the last thinking step's thoughts as the final response to ensure content is never swallowed.
  if (!isLoading && !finalResponseStep && thinkingSteps.length > 0) {
    const lastThinkIdx = thinkingSteps.reduce(
      (acc, s, idx) => (s.type === "thinking" ? idx : acc),
      -1,
    );
    if (lastThinkIdx !== -1) {
      const fallbackStep = thinkingSteps[lastThinkIdx];
      thinkingSteps.splice(lastThinkIdx, 1);
      finalResponseStep = {
        id: fallbackStep.id + "-fallback-text",
        type: "text_response",
        content: fallbackStep.content,
        isStreaming: false,
      };
    }
  }

  const isComplete = !isLoading;

  return (
    <div className="relative pl-7 ml-3.5 border-l border-primary/20 dark:border-primary/10 flex flex-col gap-3 my-4">
      {/* Indicator dot for the entire group */}
      <div className="absolute -left-[36px] top-[14px] size-3 rounded-full border-2 border-primary bg-background z-10 flex items-center justify-center">
        <span className="size-1 bg-primary rounded-full" />
      </div>

      {/* Render intermediate thinking steps grouped together inside a collapsible timeline card */}
      {thinkingSteps.length > 0 && (
        <div className="relative animate-fade-in">
          <ThinkingProcessCard steps={thinkingSteps} isComplete={isComplete} />
        </div>
      )}

      {/* Render the final markdown response outside/below the thinking card */}
      {finalResponseStep && (
        <div className="relative animate-fade-in">
          <div className="py-1">
            {finalResponseStep.isStreaming ? (
              <StreamingText content={finalResponseStep.content} />
            ) : (
              <Markdown content={finalResponseStep.content} />
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="relative animate-fade-in mt-1">
          <LoadingIndicator />
        </div>
      )}
    </div>
  );
};

// Main Chat Component
export const Chat: React.FC = () => {
  const { messages, isLoading, sendMessage, clearChat } = useChat();

  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const isAutoScrollEnabledRef = useRef(true);

  // Sync ref with state
  useEffect(() => {
    isAutoScrollEnabledRef.current = isAutoScrollEnabled;
  }, [isAutoScrollEnabled]);

  // Keep scroll locked to bottom on any inner height changes (streaming, tool log cards, collapsible opens)
  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isAutoScrollEnabledRef.current) {
        container.scrollTop = container.scrollHeight - container.clientHeight;
      }
    });

    resizeObserver.observe(inner);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Force autoscroll to bottom when messages list grows (meaning new user or assistant interaction started)
  const prevMessagesLength = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      setIsAutoScrollEnabled(true);
      const container = containerRef.current;
      if (container) {
        // Use a microtask/timeout to let layout settle, then scroll to exact bottom
        setTimeout(() => {
          container.scrollTop = container.scrollHeight - container.clientHeight;
        }, 50);
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    // We are at the bottom if remaining scroll height is less than 15px
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 15;
    setIsAutoScrollEnabled(isAtBottom);
  };

  // Group messages into consecutive runs by role
  const messageGroups: MessageGroup[] = [];
  messages.forEach((msg) => {
    const lastGroup = messageGroups.at(-1);
    if (lastGroup && lastGroup.role === msg.role) {
      lastGroup.messages.push(msg);
    } else {
      messageGroups.push({
        role: msg.role === "user" ? "user" : "assistant",
        messages: [msg],
      });
    }
  });

  // Check if we need to show loading after the last group
  const showLoadingAfterLastGroup = isLoading && messages.at(-1)?.role === "user";

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Messages Area */}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        <div className="h-8 max-w-3xl mx-auto px-4 mt-2">
          {/* New Chat Button - Floating */}
          {messages.length > 0 && (
            <Button onClick={clearChat} title="Start new chat" variant="ghost">
              <Plus className="size-4" />
              New Chat
            </Button>
          )}
        </div>

        <div
          ref={innerRef}
          className={cn(
            "pb-4 relative max-w-3xl mx-auto px-4",
            messages.length === 0 && "h-full flex flex-col justify-center",
          )}
        >
          {messages.length === 0 ? (
            // Empty State
            <div className="flex items-center justify-center min-h-[350px]">
              <div className="text-center animate-fade-in max-w-sm mx-auto p-6 rounded-lg bg-muted/40 dark:bg-muted/10 border border-border/30 backdrop-blur-sm gap-4 flex flex-col shadow-xl">
                <div className="mx-auto size-14 rounded-full bg-primary/10 flex items-center justify-center animate-bounce duration-1000">
                  <span className="text-2xl filter drop-shadow-md">🫐</span>
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
                    Blueberry Copilot
                  </h3>
                  <p className="text-muted-foreground text-xs mt-1">
                    Ready to assist you with browsing and E2E automation.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1 py-1 px-2.5 rounded bg-background border border-border/40 text-[10px] font-semibold text-muted-foreground shadow-sm w-fit mx-auto">
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[9px] font-mono shadow-sm">
                    ⌘
                  </kbd>
                  <span>+</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[9px] font-mono shadow-sm">
                    E
                  </kbd>
                  <span className="ml-1 text-muted-foreground/80">to toggle sidebar</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 pt-4">
              {messageGroups.map((group, index) => {
                const groupKey = group.messages[0]?.id || `${group.role}-${index}`;
                if (group.role === "user") {
                  return (
                    <div key={groupKey} className="flex flex-col gap-4">
                      {group.messages.map((msg) => (
                        <UserMessage key={msg.id} content={msg.content} />
                      ))}
                    </div>
                  );
                } else {
                  const isLastGroup = index === messageGroups.length - 1;
                  return (
                    <AssistantMessageGroupComponent
                      key={groupKey}
                      messages={group.messages}
                      isLoading={showLoadingAfterLastGroup && isLastGroup}
                    />
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};
