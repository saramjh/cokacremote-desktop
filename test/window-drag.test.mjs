import test from 'node:test';
import assert from 'node:assert/strict';
import {bindTitlebarDrag,isTitlebarDragStart} from '../ui/window-drag.mjs';

const target=(interactive=false)=>({closest:()=>interactive?{id:'control'}:null});
test('window drag accepts primary mouse on titlebar and nested plain content',()=>{
  assert.equal(isTitlebarDragStart({button:0,detail:1,target:target()}),true);
});
test('window drag excludes buttons, inputs, labels and language dropdown',()=>{
  for(const kind of ['button','input','select','textarea','a','label','.language-control']){
    const el={closest:(selector)=>selector.includes(kind)?{tag:kind}:null};
    assert.equal(isTitlebarDragStart({button:0,detail:1,target:el}),false);
  }
});
test('window drag ignores secondary buttons, double clicks and invalid event targets',()=>{
  assert.equal(isTitlebarDragStart({button:2,detail:1,target:target()}),false);
  assert.equal(isTitlebarDragStart({button:0,detail:2,target:target()}),false);
  assert.equal(isTitlebarDragStart({button:0,detail:1,target:null}),false);
});
test('window drag delegates exactly one native call and leaves controls interactive', async ()=>{
  let listener;
  let count=0;
  bindTitlebarDrag({addEventListener:(name,cb)=>{assert.equal(name,'mousedown');listener=cb;}},()=>{count++;});
  listener({button:0,detail:1,target:target()});
  listener({button:0,detail:1,target:target(true)});
  listener({button:0,detail:2,target:target()});
  listener({button:1,detail:1,target:target()});
  assert.equal(count,1);
});
