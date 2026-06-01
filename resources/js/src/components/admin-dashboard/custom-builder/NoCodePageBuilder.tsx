import { useMemo, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Bell,
  Calendar,
  GripVertical,
  Plus,
  Settings,
  Star,
  TextCursorInput,
  Trash2,
  Type,
} from 'lucide-react';
import {
  BUTTON_VARIANTS,
  BuilderConfig,
  BuilderElement,
  STANDARD_BUTTON_SIZE,
} from './builderSchema';

interface NoCodePageBuilderProps {
  value: BuilderConfig;
  onChange: (next: BuilderConfig) => void;
}

const iconChoices = [
  { name: 'Plus', Icon: Plus },
  { name: 'ArrowRight', Icon: ArrowRight },
  { name: 'Calendar', Icon: Calendar },
  { name: 'Bell', Icon: Bell },
  { name: 'Settings', Icon: Settings },
  { name: 'Star', Icon: Star },
];

const alignClass = (align: BuilderElement['align']) => {
  if (align === 'center') return 'justify-center';
  if (align === 'right') return 'justify-end';
  return 'justify-start';
};

const resolveIcon = (iconName: string | undefined) => {
  const found = iconChoices.find((choice) => choice.name === iconName);
  return found?.Icon || Plus;
};

const makeElementId = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function NoCodePageBuilder({ value, onChange }: NoCodePageBuilderProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const elements = value.elements || [];

  const updateHero = (key: 'title' | 'description', heroValue: string) => {
    onChange({
      ...value,
      hero: {
        ...value.hero,
        [key]: heroValue,
      },
    });
  };

  const addElement = (type: BuilderElement['type']) => {
    const defaults: Record<BuilderElement['type'], Partial<BuilderElement>> = {
      text: { text: 'Add your text here', align: 'left' },
      button: { label: 'Button Label', url: '', style: 'primary', align: 'left' },
      icon_button: { label: 'Icon Button', url: '', style: 'secondary', icon: 'Plus', align: 'left' },
    };

    onChange({
      ...value,
      elements: [
        ...elements,
        {
          id: makeElementId(),
          type,
          ...defaults[type],
        } as BuilderElement,
      ],
    });
  };

  const updateElement = (id: string, patch: Partial<BuilderElement>) => {
    onChange({
      ...value,
      elements: elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
    });
  };

  const removeElement = (id: string) => {
    onChange({
      ...value,
      elements: elements.filter((element) => element.id !== id),
    });
  };

  const moveElement = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    const fromIndex = elements.findIndex((element) => element.id === fromId);
    const toIndex = elements.findIndex((element) => element.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...elements];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    onChange({ ...value, elements: next });
  };

  const preview = useMemo(
    () => (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-700 px-4 py-5 text-white">
          <h4 className="text-lg font-semibold">{value.hero.title || 'Untitled Page'}</h4>
          <p className="text-sm text-cyan-100 mt-1">{value.hero.description || 'No description'}</p>
        </div>

        <div className="space-y-3">
          {elements.length === 0 && (
            <div className="text-sm text-slate-500 dark:text-slate-400">Add components from the left to start building.</div>
          )}
          {elements.map((element) => {
            if (element.type === 'text') {
              return (
                <div key={element.id} className={`flex ${alignClass(element.align)}`}>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{element.text || 'Text block'}</p>
                </div>
              );
            }

            const Icon = resolveIcon(element.icon);
            const buttonClass = `${STANDARD_BUTTON_SIZE} ${BUTTON_VARIANTS[element.style || 'primary']}`;

            return (
              <div key={element.id} className={`flex ${alignClass(element.align)}`}>
                <button type="button" className={buttonClass}>
                  {element.type === 'icon_button' && <Icon className="h-4 w-4" />}
                  <span>{element.label || 'Button'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    ),
    [elements, value.hero.description, value.hero.title]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Page Title</label>
          <input
            type="text"
            value={value.hero.title}
            onChange={(e) => updateHero('title', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
          />

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Page Description</label>
          <textarea
            value={value.hero.description}
            onChange={(e) => updateHero('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500"
          />

          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Add Elements</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => addElement('text')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                <Type className="h-4 w-4" /> Text
              </button>
              <button type="button" onClick={() => addElement('button')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                <TextCursorInput className="h-4 w-4" /> Button
              </button>
              <button type="button" onClick={() => addElement('icon_button')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                <Plus className="h-4 w-4" /> Icon Button
              </button>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Live Preview</p>
          {preview}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
          Canvas (drag to reorder)
        </p>
        <div className="space-y-2">
          {elements.map((element, index) => (
            <div
              key={element.id}
              draggable
              onDragStart={() => setDraggingId(element.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggingId) moveElement(draggingId, element.id);
                setDraggingId(null);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <GripVertical className="h-4 w-4 text-slate-400" />
                  <span>{index + 1}. {element.type === 'icon_button' ? 'Icon Button' : element.type === 'button' ? 'Button' : 'Text'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeElement(element.id)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {element.type === 'text' ? (
                  <input
                    type="text"
                    value={element.text || ''}
                    onChange={(e) => updateElement(element.id, { text: e.target.value })}
                    className="md:col-span-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    placeholder="Text content"
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      value={element.label || ''}
                      onChange={(e) => updateElement(element.id, { label: e.target.value })}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="Button label"
                    />
                    <input
                      type="url"
                      value={element.url || ''}
                      onChange={(e) => updateElement(element.id, { url: e.target.value })}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="URL (optional)"
                    />
                    <select
                      value={element.style || 'primary'}
                      onChange={(e) => updateElement(element.id, { style: e.target.value as BuilderElement['style'] })}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="ghost">Ghost</option>
                    </select>
                    {element.type === 'icon_button' && (
                      <select
                        value={element.icon || 'Plus'}
                        onChange={(e) => updateElement(element.id, { icon: e.target.value })}
                        className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      >
                        {iconChoices.map((choice) => (
                          <option key={choice.name} value={choice.name}>{choice.name}</option>
                        ))}
                      </select>
                    )}
                  </>
                )}

                <div className="md:col-span-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Align</span>
                  <button type="button" onClick={() => updateElement(element.id, { align: 'left' })} className={`p-1.5 rounded ${element.align === 'left' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}><AlignLeft className="h-4 w-4" /></button>
                  <button type="button" onClick={() => updateElement(element.id, { align: 'center' })} className={`p-1.5 rounded ${element.align === 'center' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}><AlignCenter className="h-4 w-4" /></button>
                  <button type="button" onClick={() => updateElement(element.id, { align: 'right' })} className={`p-1.5 rounded ${element.align === 'right' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}><AlignRight className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Buttons use a fixed size preset to keep spacing consistent with the main system UI.
        </p>
      </div>
    </div>
  );
}
