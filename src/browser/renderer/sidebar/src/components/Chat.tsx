import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { ArrowUp, Plus } from "lucide-react";
import type { Message } from "../contexts/ChatContext";
import { useChat } from "../contexts/ChatContext";
import { cn } from "@common/lib/utils";
import { Button } from "@common/components/Button";

// Auto-scroll hook
const useAutoScroll = (messages: Message[]) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  useLayoutEffect(() => {
    if (messages.length > prevCount.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }, 100);
    }
    prevCount.current = messages.length;
  }, [messages.length]);

  return scrollRef;
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

// Assistant Message Component - appears on the left
const AssistantMessage: React.FC<{
  content: string;
  isStreaming?: boolean;
}> = ({ content, isStreaming }) => (
  <div className="relative w-full animate-fade-in">
    <div className="py-1">
      {isStreaming ? <StreamingText content={content} /> : <Markdown content={content} />}
    </div>
  </div>
);

const LOADING_PHASES = ["Thinking...", "Reading context...", "Tinkering..."];

// Loading Indicator with spinning star
const LoadingIndicator: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setPhase((prev) => (prev + 1) % LOADING_PHASES.length);
    }, 2000);
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

// Chat Input Component with pill design
const ChatInput: React.FC<{
  onSend: (message: string) => void;
  disabled: boolean;
}> = ({ onSend, disabled }) => {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const { scrollHeight } = textareaRef.current;
      const newHeight = Math.min(scrollHeight, 200); // Max 200px
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
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

  return (
    <div
      className={cn(
        "w-full border p-3 rounded-lg bg-background dark:bg-secondary",
        "shadow-chat animate-spring-scale outline-none transition-all duration-200",
        isFocused ? "border-primary/20 dark:border-primary/30" : "border-border",
      )}
    >
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
              placeholder="Send a message..."
              className="w-full resize-none outline-none bg-transparent 
                                     text-foreground placeholder:text-muted-foreground
                                     min-h-[24px] max-h-[200px]"
              rows={1}
              style={{ lineHeight: "24px" }}
            />
          </div>
        </div>
      </div>

      {/* Send Button */}
      <div className="w-full flex items-center gap-1.5 px-1 mt-2 mb-1">
        <div className="flex-1" />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
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

// Conversation Turn Component
interface ConversationTurn {
  user?: Message;
  assistant?: Message;
}

const ConversationTurnComponent: React.FC<{
  turn: ConversationTurn;
  isLoading?: boolean;
}> = ({ turn, isLoading }) => (
  <div className="pt-12 flex flex-col gap-8">
    {turn.user && <UserMessage content={turn.user.content} />}
    {turn.assistant && (
      <AssistantMessage content={turn.assistant.content} isStreaming={turn.assistant.isStreaming} />
    )}
    {isLoading && (
      <div className="flex justify-start">
        <LoadingIndicator />
      </div>
    )}
  </div>
);

// Main Chat Component
export const Chat: React.FC = () => {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const scrollRef = useAutoScroll(messages);

  // Group messages into conversation turns
  const conversationTurns: ConversationTurn[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") {
      const turn: ConversationTurn = { user: messages[i] };
      if (messages[i + 1]?.role === "assistant") {
        turn.assistant = messages[i + 1];
        i++; // Skip next message since we've paired it
      }
      conversationTurns.push(turn);
    } else if (messages[i].role === "assistant" && (i === 0 || messages[i - 1]?.role !== "user")) {
      // Handle standalone assistant messages
      conversationTurns.push({ assistant: messages[i] });
    }
  }

  // Check if we need to show loading after the last turn
  const showLoadingAfterLastTurn = isLoading && messages.at(-1)?.role === "user";

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="h-8 max-w-3xl mx-auto px-4">
          {/* New Chat Button - Floating */}
          {messages.length > 0 && (
            <Button onClick={clearChat} title="Start new chat" variant="ghost">
              <Plus className="size-4" />
              New Chat
            </Button>
          )}
        </div>

        <div className="pb-4 relative max-w-3xl mx-auto px-4">
          {messages.length === 0 ? (
            // Empty State
            <div className="flex items-center justify-center h-full min-h-[350px]">
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
            <>
              {/* Render conversation turns */}
              {conversationTurns.map((turn, index) => (
                <ConversationTurnComponent
                  key={turn.user?.id || turn.assistant?.id || index}
                  turn={turn}
                  isLoading={showLoadingAfterLastTurn && index === conversationTurns.length - 1}
                />
              ))}
            </>
          )}

          {/* Scroll anchor */}
          <div ref={scrollRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};
