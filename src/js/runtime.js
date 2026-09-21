/* Mise browser runtime: tiny local renderer + hooks. No external dependencies.
   Updates are morphed into the existing DOM so typing does not rebuild/flash
   the entire application on every keystroke. */
const Fragment = Symbol("Fragment");
function flatChildren(input,out=[]){for(const child of input){if(Array.isArray(child))flatChildren(child,out);else if(child!==null&&child!==undefined&&child!==false&&child!==true)out.push(child)}return out}
function h(type,props,...children){props=props||{};const all=flatChildren(children);return{type,props:{...props,children:all.length===0?undefined:all.length===1?all[0]:all},key:props.key??null}}
const __hooks=new Map();let __component=null,__hookIndex=0,__used=new Set(),__pendingEffects=[],__scheduled=false,__root=null,__rootVNode=null,__nodes=new Map(),__autoFocus=null;
function depsChanged(a,b){if(!a||!b||a.length!==b.length)return true;for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))return true;return false}
function hookSlot(kind,init){if(!__component)throw new Error(kind+" called outside component");let list=__hooks.get(__component);if(!list){list=[];__hooks.set(__component,list)}const i=__hookIndex++;if(!list[i])list[i]={kind,...init()};return[list[i],i,__component]}
function useState(initial){const [slot,index,path]=hookSlot("state",()=>({value:typeof initial==="function"?initial():initial}));const setter=value=>{const list=__hooks.get(path);if(!list||!list[index])return;const current=list[index].value;const next=typeof value==="function"?value(current):value;if(Object.is(current,next))return;list[index].value=next;scheduleRender()};return[slot.value,setter]}
function useRef(initial){const [slot]=hookSlot("ref",()=>({ref:{current:initial}}));return slot.ref}
function useMemo(factory,deps){const [slot]=hookSlot("memo",()=>({deps:undefined,value:undefined,ready:false}));if(!slot.ready||depsChanged(slot.deps,deps)){slot.value=factory();slot.deps=deps;slot.ready=true}return slot.value}
function useEffect(effect,deps){const [slot,index,path]=hookSlot("effect",()=>({deps:undefined,cleanup:null}));if(depsChanged(slot.deps,deps)){__pendingEffects.push({path,index,effect,deps})}}
function scheduleRender(){if(__scheduled)return;__scheduled=true;const run=()=>{__scheduled=false;renderRoot()};if(typeof requestAnimationFrame==="function")requestAnimationFrame(run);else queueMicrotask(run)}
function setStyle(el,obj){if(typeof obj==="string"){el.style.cssText=obj;return}for(const [k,v] of Object.entries(obj||{})){if(k.startsWith("--"))el.style.setProperty(k,String(v));else try{el.style[k]=v==null?"":String(v)}catch{}}}
function svgAttr(name){return({className:"class",strokeWidth:"stroke-width",strokeLinecap:"stroke-linecap",strokeLinejoin:"stroke-linejoin",strokeMiterlimit:"stroke-miterlimit",fillRule:"fill-rule",clipRule:"clip-rule"})[name]||name.replace(/[A-Z]/g,m=>"-"+m.toLowerCase())}
function eventName(name,el,tag){let ev=name.slice(2).toLowerCase();if(ev==="doubleclick")ev="dblclick";if(ev==="change"){const type=String(el.type||"").toLowerCase();ev=(tag==="select"||type==="file"||type==="checkbox"||type==="radio")?"change":"input"}return ev}
function applyProp(el,name,value,isSvg,tag){if(name==="children"||name==="key"||name==="ref"||value===undefined||value===null)return;if(name==="className"){el.setAttribute("class",String(value));return}if(name==="style"){setStyle(el,value);return}if(name.startsWith("on")&&typeof value==="function"){const ev=eventName(name,el,tag);el.__miseListeners=el.__miseListeners||{};const previous=el.__miseListeners[ev];if(previous)el.removeEventListener(ev,previous);el.__miseListeners[ev]=value;el.addEventListener(ev,value);return}if(isSvg){el.setAttribute(svgAttr(name),String(value));return}if(name==="htmlFor"){el.setAttribute("for",String(value));return}if(name.startsWith("aria-")||name.startsWith("data-")||name==="role"){el.setAttribute(name,String(value));return}if(name==="autoFocus"){if(value){__autoFocus=el;el.__miseAutoFocus=true}return}if(["value","checked","selected","disabled","hidden","multiple","required","readOnly"].includes(name)){try{el[name]=value}catch{};return}if(typeof value==="boolean"){if(value)el.setAttribute(name,"");return}try{if(name in el&&name!=="list"&&name!=="form")el[name]=value;else el.setAttribute(name,String(value))}catch{el.setAttribute(name,String(value))}}
function childArray(value){return Array.isArray(value)?flatChildren(value):value===undefined?[]:[value]}
function renderVNode(vnode,path="0",svg=false){if(vnode===null||vnode===undefined||vnode===false||vnode===true)return document.createDocumentFragment();if(typeof vnode==="string"||typeof vnode==="number"||typeof vnode==="bigint")return document.createTextNode(String(vnode));if(Array.isArray(vnode)){const f=document.createDocumentFragment();childArray(vnode).forEach((c,i)=>f.appendChild(renderVNode(c,path+"/"+i,svg)));return f}if(vnode.type===Fragment){const f=document.createDocumentFragment();childArray(vnode.props?.children).forEach((c,i)=>f.appendChild(renderVNode(c,path+"/f"+i,svg)));return f}const marker=vnode.key!=null?"k:"+String(vnode.key):"n";const here=path+"/"+marker;if(typeof vnode.type==="function"){const prevComp=__component,prevIndex=__hookIndex;const compPath=here+":c:"+(vnode.type.name||"anon");__component=compPath;__hookIndex=0;__used.add(compPath);let result;try{result=vnode.type(vnode.props||{})}finally{__component=prevComp;__hookIndex=prevIndex}return renderVNode(result,compPath+"/r",svg)}if(typeof vnode.type!=="string")return document.createDocumentFragment();const tag=vnode.type;const nextSvg=svg||tag==="svg";const el=nextSvg?document.createElementNS("http://www.w3.org/2000/svg",tag):document.createElement(tag);__nodes.set(here,el);if(!nextSvg)el.dataset.vpath=here;const props=vnode.props||{};for(const [name,value] of Object.entries(props)){if(tag==="select"&&name==="value")continue;applyProp(el,name,value,nextSvg,tag)}const ref=props.ref;if(ref&&typeof ref==="object")ref.current=el;else if(typeof ref==="function")ref(el);if(ref)el.__miseRef=ref;childArray(props.children).forEach((c,i)=>{const id=(c&&typeof c==="object"&&!Array.isArray(c)&&c.key!=null)?"k:"+String(c.key):String(i);el.appendChild(renderVNode(c,here+"/"+id,nextSvg))});/* A select cannot resolve its value until its option children exist. Applying value earlier makes the browser fall back to the first option (usually Unsorted). */if(tag==="select"&&props.value!==undefined&&props.value!==null){try{el.value=String(props.value)}catch{}}return el}
function cleanupUnused(){for(const [path,list] of __hooks){if(__used.has(path))continue;for(const slot of list){if(slot?.kind==="effect"&&typeof slot.cleanup==="function")try{slot.cleanup()}catch(e){console.error(e)}}__hooks.delete(path)}}
function runEffects(){for(const item of __pendingEffects){const list=__hooks.get(item.path),slot=list?.[item.index];if(!slot)continue;if(typeof slot.cleanup==="function")try{slot.cleanup()}catch(e){console.error(e)}let cleanup=null;try{cleanup=item.effect()}catch(e){console.error(e)}slot.cleanup=typeof cleanup==="function"?cleanup:null;slot.deps=item.deps}}

function sameElementKind(a,b){return a?.nodeType===1&&b?.nodeType===1&&a.namespaceURI===b.namespaceURI&&a.tagName===b.tagName}
function syncListeners(oldEl,newEl){const oldMap=oldEl.__miseListeners||{},newMap=newEl.__miseListeners||{};for(const [ev,handler] of Object.entries(oldMap)){if(newMap[ev]!==handler)oldEl.removeEventListener(ev,handler)}for(const [ev,handler] of Object.entries(newMap)){if(oldMap[ev]!==handler)oldEl.addEventListener(ev,handler)}oldEl.__miseListeners={...newMap}}
function syncAttributes(oldEl,newEl){for(const attr of Array.from(oldEl.attributes)){if(!newEl.hasAttribute(attr.name))oldEl.removeAttribute(attr.name)}for(const attr of Array.from(newEl.attributes)){if(oldEl.getAttribute(attr.name)!==attr.value)oldEl.setAttribute(attr.name,attr.value)}}
function syncFormState(oldEl,newEl){const tag=oldEl.tagName?.toLowerCase();try{
    if(tag==="input"){
        if(String(oldEl.type).toLowerCase()!=="file"&&oldEl.value!==newEl.value)oldEl.value=newEl.value;
        oldEl.checked=newEl.checked;oldEl.disabled=newEl.disabled;oldEl.readOnly=newEl.readOnly;oldEl.required=newEl.required;
    }else if(tag==="textarea"){
        if(oldEl.value!==newEl.value)oldEl.value=newEl.value;oldEl.disabled=newEl.disabled;oldEl.readOnly=newEl.readOnly;oldEl.required=newEl.required;
    }else if(tag==="select"){
        oldEl.disabled=newEl.disabled;oldEl.multiple=newEl.multiple;if(oldEl.value!==newEl.value)oldEl.value=newEl.value;
    }else if(tag==="option") oldEl.selected=newEl.selected;
    else if(tag==="button") oldEl.disabled=newEl.disabled;
    oldEl.hidden=newEl.hidden;
}catch{}}
function syncRef(oldEl,newEl){const ref=newEl.__miseRef;oldEl.__miseRef=ref;if(ref&&typeof ref==="object")ref.current=oldEl;else if(typeof ref==="function")ref(oldEl)}
function findChildByPath(parent,path,start){if(!path)return null;for(let i=start;i<parent.childNodes.length;i++){const child=parent.childNodes[i];if(child.nodeType===1&&child.dataset?.vpath===path)return child}return null}
function morphNode(oldNode,newNode){
    if(!oldNode)return newNode;
    if(oldNode.nodeType!==newNode.nodeType){oldNode.replaceWith(newNode);return newNode}
    if(oldNode.nodeType===3){if(oldNode.nodeValue!==newNode.nodeValue)oldNode.nodeValue=newNode.nodeValue;return oldNode}
    if(oldNode.nodeType!==1){if(!oldNode.isEqualNode(newNode))oldNode.replaceWith(newNode);return newNode}
    if(!sameElementKind(oldNode,newNode)){oldNode.replaceWith(newNode);return newNode}

    const oldIcon=oldNode.getAttribute("data-icon-name"),newIcon=newNode.getAttribute("data-icon-name");
    syncAttributes(oldNode,newNode);syncListeners(oldNode,newNode);syncRef(oldNode,newNode);

    /* Lucide has already replaced the icon placeholder with SVG. Preserve that
       SVG when the icon identity is unchanged; otherwise only that icon is
       replaced and Lucide refreshes it after the morph. */
    const keepLucideSvg=oldIcon&&oldIcon===newIcon&&oldNode.classList.contains("ui-icon")&&oldNode.firstElementChild?.tagName?.toLowerCase()==="svg";
    if(!keepLucideSvg){
        const newChildren=Array.from(newNode.childNodes);
        for(let i=0;i<newChildren.length;i++){
            const desired=newChildren[i];
            let current=oldNode.childNodes[i];
            const desiredPath=desired.nodeType===1?desired.dataset?.vpath:null;
            if(current&&desiredPath&&current.nodeType===1&&current.dataset?.vpath!==desiredPath){const keyed=findChildByPath(oldNode,desiredPath,i+1);if(keyed){oldNode.insertBefore(keyed,current);current=keyed}}
            if(!current){oldNode.appendChild(desired);continue}
            morphNode(current,desired);
        }
        while(oldNode.childNodes.length>newChildren.length)oldNode.removeChild(oldNode.lastChild);
    }
    syncFormState(oldNode,newNode);
    return oldNode;
}
function nodeForPath(root,path){if(!path)return null;for(const el of root.querySelectorAll("[data-vpath]")){if(el.dataset.vpath===path)return el}return null}
function renderRoot(){if(!__root)return;const active=document.activeElement;const activePath=active?.dataset?.vpath||null;let selection=null;if(active&&(active.tagName==="INPUT"||active.tagName==="TEXTAREA")){try{selection=[active.selectionStart,active.selectionEnd,active.selectionDirection]}catch{}}
    __used=new Set();__pendingEffects=[];__nodes=new Map();__autoFocus=null;const dom=renderVNode(__rootVNode,"root",false);
    if(dom.nodeType===11){__root.replaceChildren(dom)}
    else if(!__root.firstChild){__root.appendChild(dom)}
    else{morphNode(__root.firstChild,dom);while(__root.childNodes.length>1)__root.removeChild(__root.lastChild)}
    if(typeof refreshLucideIcons==="function")refreshLucideIcons();cleanupUnused();
    let focusTarget=activePath?nodeForPath(__root,activePath):null;
    if(focusTarget){
        if(document.activeElement!==focusTarget){try{focusTarget.focus({preventScroll:true})}catch{}}
        if(selection&&typeof focusTarget.setSelectionRange==="function"&&selection[0]!=null){try{focusTarget.setSelectionRange(selection[0],selection[1],selection[2]||"none")}catch{}}
    }else if(__autoFocus){
        /* autoFocus is only for first mount. Never let it steal focus from an
           existing control (number inputs do not expose selectionStart). */
        const autoPath=__autoFocus.dataset?.vpath;const auto=autoPath?nodeForPath(__root,autoPath):null;try{auto?.focus()}catch{}
    }
    runEffects()}
function createRoot(el){return{render(vnode){__root=el;__rootVNode=vnode;renderRoot()}}}
function safeUuid(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==="x"?r:(r&3|8);return v.toString(16)})}
function uuid(){try{return globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():safeUuid()}catch{return safeUuid()}}
