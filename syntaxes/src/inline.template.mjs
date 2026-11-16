// Inside a template, a <template> tag is a plain HTML element, so the injection is left out there.
const NOT_IN_TEMPLATE = '-meta.js.embeddedTemplateWithoutArgs -meta.js.embeddedTemplateWithArgs';

export default {
  fileTypes: ['gjs', 'gts'],
  injectionSelector: `L:source.gjs -comment -(string -meta.embedded) ${NOT_IN_TEMPLATE}, L:source.gts -comment -(string -meta.embedded) ${NOT_IN_TEMPLATE}`,
  patterns: [
    {
      name: 'meta.js.embeddedTemplateWithoutArgs',
      begin: '\\s*(<)(template)\\s*(>)',
      beginCaptures: {
        1: {
          name: 'punctuation.definition.tag.html',
        },
        2: {
          name: 'entity.name.tag.other.html',
        },
        3: {
          name: 'punctuation.definition.tag.html',
        },
      },
      end: '(</)(template)(>)',
      endCaptures: {
        1: {
          name: 'punctuation.definition.tag.html',
        },
        2: {
          name: 'entity.name.tag.other.html',
        },
        3: {
          name: 'punctuation.definition.tag.html',
        },
      },
      // A nested <template> element comes first, so that its closing tag does not end this block.
      patterns: [
        {
          include: 'text.html.ember-handlebars#nested-template-element',
        },
        {
          include: 'text.html.ember-handlebars',
        },
      ],
    },
    {
      name: 'meta.js.embeddedTemplateWithArgs',
      begin: '(<)(template)',
      beginCaptures: {
        1: {
          name: 'punctuation.definition.tag.html',
        },
        2: {
          name: 'entity.name.tag.other.html',
        },
      },
      end: '(</)(template)(>)',
      endCaptures: {
        1: {
          name: 'punctuation.definition.tag.html',
        },
        2: {
          name: 'entity.name.tag.other.html',
        },
        3: {
          name: 'punctuation.definition.tag.html',
        },
      },
      patterns: [
        {
          begin: '(?<=\\<template)',
          end: '(?=\\>)',
          patterns: [
            {
              include: 'text.html.ember-handlebars#tag-like-content',
            },
          ],
        },
        {
          begin: '(>)',
          beginCaptures: {
            1: {
              name: 'punctuation.definition.tag.end.js',
            },
          },
          end: '(?=</template>)',
          contentName: 'meta.html.embedded.block',
          patterns: [
            {
              include: 'text.html.ember-handlebars#nested-template-element',
            },
            {
              include: 'text.html.ember-handlebars',
            },
          ],
        },
      ],
    },
  ],
  scopeName: 'inline.template',
};
