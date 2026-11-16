// Node-only IndexedDB test adapter. Production never falls back to localStorage.
const fs=require('node:fs');
const path=require('node:path');
const {webcrypto}=require('node:crypto');
const {IDBFactory,IDBObjectStore}=require('fake-indexeddb');
const vm=require('node:vm');
const factories=new WeakMap();
const originalPut=IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.__faultStore?.fail)throw new DOMException('Synthetic quota failure','QuotaExceededError');return originalPut.apply(this,args);};
function prepare(context,storage,identity=storage){
  let factory=factories.get(identity);if(!factory){factory=new IDBFactory();factories.set(identity,factory);}
  context.indexedDB={open(...args){const request=factory.open(...args);request.addEventListener('success',()=>{request.result.__faultStore=storage;});return request;}};
  context.crypto=webcrypto;context.TextEncoder=TextEncoder;context.structuredClone=structuredClone;
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../site/assets/js/storage-service.js'),'utf8'),context);
}
module.exports={prepare};
