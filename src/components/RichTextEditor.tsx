import { useRef, useCallback, useState, useEffect } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Palette, Type,
  Paperclip, AtSign, Minimize2, ListOrdered as ListOrderedIcon, Quote,
} from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onAttach?: () => void;
  onMention?: () => void;
  onExpand?: () => void;
  onSave?: () => void;
}

const COLORS = [
  "#000000", "#374151", "#6B7280", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899",
];

const FONT_SIZES = [
  { label: "Мелкий", value: "1" },
  { label: "Обычный", value: "3" },
  { label: "Средний", value: "5" },
  { label: "Крупный", value: "7" },
];

const tools = [
  { icon: Bold, label: "Жирный", command: "bold" },
  { icon: Italic, label: "Курсив", command: "italic" },
  { icon: Underline, label: "Подчёркнутый", command: "underline" },
  { icon: Strikethrough, label: "Зачёркнутый", command: "strikeThrough" },
  { icon: List, label: "Список", command: "insertUnorderedList" },
  { icon: ListOrdered, label: "Нумерация", command: "insertOrderedList" },
  { icon: AlignLeft, label: "По левому", command: "justifyLeft" },
  { icon: AlignCenter, label: "По центру", command: "justifyCenter" },
  { icon: AlignRight, label: "По правому", command: "justifyRight" },
];

const RichTextEditor = ({ value, onChange, placeholder, onAttach, onMention, onExpand, onSave }: Props) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const [isEmpty, setIsEmpty] = useState(!value);

  const checkEmpty = useCallback((el: HTMLDivElement) => {
    const text = el.textContent || "";
    setIsEmpty(text.trim().length === 0);
  }, []);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      checkEmpty(editorRef.current);
    }
  }, [onChange, checkEmpty]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      checkEmpty(editorRef.current);
    }
  }, [onChange, checkEmpty]);

  const handleRef = useCallback(
    (el: HTMLDivElement | null) => {
      (editorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      if (el && !initializedRef.current && value) {
        el.innerHTML = value;
        initializedRef.current = true;
        checkEmpty(el);
      } else if (el) {
        checkEmpty(el);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const checkSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !editorRef.current || !editorRef.current.contains(sel.anchorNode)) {
        setShowToolbar(false);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();
      const top = rect.top - editorRect.top - 44;
      const left = Math.max(0, Math.min(rect.left - editorRect.left + rect.width / 2 - 140, editorRect.width - 280));
      setToolbarPos({ top, left });
      setShowToolbar(true);
    };
    document.addEventListener("selectionchange", checkSelection);
    return () => document.removeEventListener("selectionchange", checkSelection);
  }, []);

  return (
    <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.03] overflow-visible relative">
      <div className="relative">
        {isEmpty && (
          <div className="absolute top-3 left-3 text-foreground/50 text-xs font-medium pointer-events-none select-none">
            {placeholder || "Описание"}
          </div>
        )}
        <div
          ref={handleRef}
          contentEditable
          onInput={handleInput}
          className="min-h-[120px] max-h-[240px] overflow-auto px-3 py-3 text-foreground/80 focus:outline-none relative z-[1]"
          style={{ fontSize: 15, lineHeight: 1.6 }}
        />
        <div
          ref={toolbarRef}
          className="absolute z-50 transition-all duration-200 ease-out"
          style={{
            top: toolbarPos.top, left: toolbarPos.left,
            opacity: showToolbar ? 1 : 0,
            transform: showToolbar ? "translateY(0) scale(1)" : "translateY(4px) scale(0.97)",
            pointerEvents: showToolbar ? "auto" : "none",
          }}
        >
          <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-foreground/[0.08] bg-background shadow-lg shadow-foreground/[0.06] backdrop-blur-sm">
            {tools.map((tool) => (
              <button key={tool.label} type="button" title={tool.label}
                onMouseDown={(e) => { e.preventDefault(); exec(tool.command); }}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-foreground/[0.06] text-foreground/50 hover:text-foreground/80 transition-colors">
                <tool.icon className="w-3.5 h-3.5" />
              </button>
            ))}
            <div className="w-px h-4 bg-foreground/[0.08] mx-0.5" />
            <div className="relative">
              <button type="button" title="Цвет текста"
                onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click(); }}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-foreground/[0.06] text-foreground/50 hover:text-foreground/80 transition-colors">
                <Palette className="w-3.5 h-3.5" />
              </button>
              <input ref={colorInputRef} type="color" className="absolute opacity-0 w-0 h-0 pointer-events-none" onChange={(e) => exec("foreColor", e.target.value)} />
            </div>
            {COLORS.slice(0, 5).map((c) => (
              <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); exec("foreColor", c); }}
                className="w-3.5 h-3.5 rounded-full border border-foreground/10 hover:scale-125 transition-transform" style={{ backgroundColor: c }} />
            ))}
            <div className="w-px h-4 bg-foreground/[0.08] mx-0.5" />
            <select onMouseDown={(e) => e.preventDefault()} onChange={(e) => { if (e.target.value) exec("fontSize", e.target.value); e.target.value = ""; }} defaultValue=""
              className="h-7 px-1 rounded-md bg-transparent text-foreground/50 hover:text-foreground/80 border-none outline-none cursor-pointer" style={{ fontSize: 10 }}>
              <option value="" disabled>Aa</option>
              {FONT_SIZES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-t border-foreground/[0.06]">
        
        <button type="button" title="Упомянуть пользователя" onClick={onMention} className="w-6 h-6 flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.04] transition-colors"><AtSign className="w-3 h-3" /></button>
        <button type="button" title="Маркированный список" onMouseDown={(e) => { e.preventDefault(); editorRef.current?.focus(); exec("insertUnorderedList"); }} className="w-6 h-6 flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.04] transition-colors"><List className="w-3 h-3" /></button>
        <button type="button" title="Нумерованный список" onMouseDown={(e) => { e.preventDefault(); editorRef.current?.focus(); exec("insertOrderedList"); }} className="w-6 h-6 flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.04] transition-colors"><ListOrderedIcon className="w-3 h-3" /></button>
        <button type="button" title="Цитата" onMouseDown={(e) => { e.preventDefault(); editorRef.current?.focus(); exec("formatBlock", "blockquote"); }} className="w-6 h-6 flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.04] transition-colors"><Quote className="w-3 h-3" /></button>
        <div className="flex-1" />
        {onSave && (
          <button type="button" onClick={onSave} className="px-3 py-1 rounded-md bg-blue1 text-white text-[11px] font-medium hover:bg-blue1/80 transition-colors mr-1">
            Сохранить
          </button>
        )}
        <button type="button" title="Свернуть" onClick={onExpand} className="w-6 h-6 flex items-center justify-center rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-foreground/[0.04] transition-colors"><Minimize2 className="w-3 h-3" /></button>
      </div>
    </div>
  );
};

export default RichTextEditor;
