function regexes(extension) {
  return {
    fencedCodeBlock: {
      begin: `(^|\\G)(\\s*)(\\\`{3,}|~{3,})\\s*(?i:(${extension})(\\s+[^\`~]*)?$)`,
      end: '(^|\\G)(\\2|\\s{0,3})(\\3)\\s*$',
    },
    embeddedBlock: {
      begin: '(^|\\G)(\\s*)(.*)',
      while: '(^|\\G)(?!\\s*([`~]{3,})\\s*$)',
    },
  };
}

function codeblock(extension) {
  return {
    name: 'markup.fenced_code.block.markdown',
    begin: regexes(extension).fencedCodeBlock.begin,
    end: regexes(extension).fencedCodeBlock.end,
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
        begin: regexes(extension).embeddedBlock.begin,
        while: regexes(extension).embeddedBlock.while,
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
  injectionSelector: 'L:text.html.markdown',
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
