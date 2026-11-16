<template>
  {{#if @isLoading}}
    <p>Loading...</p>
  {{else if @error}}
    <p class="error">{{@error.message}}</p>
  {{else}}
    {{#unless @items.length}}
      <p>No items</p>
    {{/unless}}
  {{/if}}

  {{#each @items key="id" as |item index|}}
    {{index}}. {{item.name}}
  {{else}}
    Empty
  {{/each}}

  {{#each-in @record as |key value|}}
    <dt>{{key}}</dt><dd>{{value}}</dd>
  {{/each-in}}

  {{#let (hash name=@name age=@age) as |person|}}
    {{person.name}} is {{person.age}}
  {{/let}}

  {{#in-element this.destination}}
    <div class="modal">Portal content</div>
  {{/in-element}}

  {{~#if @tight~}}
    no whitespace
  {{~/if~}}
</template>
