function codeblock(extension) {
  return {
    name: 'markup.fenced_code.block.markdown',
    begin: `(^|\\G)(\\s*)(\\\`{3,}|~{3,})\\s*(?i:(${extension})(\\s+[^\`~]*)?$)`,
    end: '(^|\\G)(\\2|\\s{0,3})(\\3)\\s*$',
    beginCaptures: {
      3: {
        name: 'punctuation.definition.markdown',
      },
      4: {
        name: 'fenced_code.block.language.markdown',
      },
      5: {
        name: 'fenced_code.block.language.attributes.markdown',
      },
    },
    endCaptures: {
      3: {
        name: 'punctuation.definition.markdown',
      },
    },
    patterns: [
      {
        begin: '(^|\\G)(\\s*)(.*)',
        while: '(^|\\G)(?!\\s*([`~]{3,})\\s*$)',
        contentName: `meta.embedded.block.${extension}`,
        patterns: [
          {
            include: `source.${extension}`,
          },
        ],
      },
    ],
  };
}

export default {
  fileTypes: [],
  // The build adds the Glimmer template rules to these patterns, so templates in code blocks are highlighted.
  // The injection is left out of prose (paragraphs and headings), where a <template> tag or an hbs`...` call is
  // plain text. It is also left out inside a template, where a <template> tag is a plain HTML element.
  injectionSelector:
    'L:text.html.markdown -meta.paragraph.markdown -markup.heading.markdown -meta.js.embeddedTemplateWithoutArgs -meta.js.embeddedTemplateWithArgs',
  patterns: [
    {
      include: '#gts-code-block',
    },
    {
      include: '#gjs-code-block',
    },
  ],
  repository: {
    'gts-code-block': codeblock('gts'),
    'gjs-code-block': codeblock('gjs'),
  },
  scopeName: 'markdown.glimmer.codeblock',
};
