<template>
  {{"a string literal"}}
  {{'single quotes'}}
  {{ "spaced" }}
  <p title={{"quoted"}} data-x={{42}}></p>
  {{42}}
  {{-1.5}}
  {{0.25}}
  {{format 42 -3}}
  {{true}} {{false}} {{null}} {{undefined}}
  {{if true "a"}}
  {{hash compact=true count=3 label=null}}
  {{format (hash a=undefined)}}
  <Panel @collapsed={{false}} />
  {{trueValue}} {{nullable}} {{@undefinedThing}} {{item42}}
</template>
