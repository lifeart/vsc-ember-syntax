import { precompileTemplate } from '@ember/template-compilation';

export const Precompiled = precompileTemplate<{ Args: { text: string } }>(`<em>{{@text}}</em>`, {
  strictMode: true,
});

export const Nested = precompileTemplate<{
  Args: {
    onSave: (data: { id: number; tags: Array<string> }) => Promise<void>;
    nested: { handler: (cb: (err: Error | null) => void) => void };
  };
}>(`<button {{on "click" @onSave}}>{{@label}}</button>`, { strictMode: true });

const after = 1;
