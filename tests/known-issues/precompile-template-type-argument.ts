import { precompileTemplate } from '@ember/template-compilation';

export const Precompiled = precompileTemplate<{ Args: { text: string } }>(`<em>{{@text}}</em>`, {
  strictMode: true,
});
