// A line comment with <template> in it
/* A block comment with <template>{{@x}}</template> in it */

<template>
  {{! A short comment }}
  {{!-- A long comment
    with {{mustaches}} and <tags> inside
  --}}
  <!-- An HTML comment with {{@arg}} inside -->
  <div {{! comment in a tag }} class="after-comment">Text</div>
  <p>Still highlighted</p>
</template>
