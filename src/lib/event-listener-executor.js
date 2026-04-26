/**
 * event-listener-executor.js
 *
 * Simulates addEventListener / dispatchEvent / removeEventListener
 * instruction by instruction, tracking the element, listener registry,
 * and event queue at each step.
 *
 * Returns step objects consumed by ModuleShell + EventListeners.svelte.
 */

import { dc } from './utils.js';

export function executeEventListenerCode(code) {
  const lines = code.split('\n');
  const steps = [];
  let memOps = 0, eventsDispatched = 0, listenersRegistered = 0;
  const output = [];
  const vars = {};
  let elements = {};  // elementName → { tag, listeners: [{event, handlerName, once}], props: {} }
  let eventQueue = [];
  let callStack = ['Global'];

  function snap(li, ni, phase, brain, memLabel) {
    steps.push({
      lineIndex: li, nextLineIndex: ni,
      vars: dc(vars), output: [...output],
      phase, brain, memLabel,
      memOps, eventsDispatched, listenersRegistered,
      elements: JSON.parse(JSON.stringify(elements)),
      eventQueue: [...eventQueue],
      callStack: [...callStack],
    });
  }

  snap(-1, 0, 'start',
    'Event listener execution begins.\n\nKey concepts:\n  • Events are asynchronous signals — they fire from the event queue\n  • addEventListener() registers a callback for a specific event type\n  • When an event fires, JS calls all matching listeners synchronously\n  • removeEventListener() cleans up — prevents memory leaks\n  • { once: true } auto-removes the listener after one fire\n\nEngine ready. Call stack: [Global]',
    'Ready · no listeners'
  );

  let li = 0;
  while (li < lines.length) {
    const ln = lines[li].trim();
    if (!ln || ln.startsWith('//') || ln === '{' || ln === '}') { li++; continue; }

    // ── Element creation ───────────────────────────────────────────────────
    // const el = document.createElement('button')
    const createM = ln.match(/(?:const|let|var)\s+(\w+)\s*=\s*document\.createElement\(['"`](\w+)['"`]\)/);
    if (createM) {
      const [, elVar, tag] = createM;
      memOps++;
      elements[elVar] = { tag, listeners: [], props: {} };
      vars[elVar] = `<${tag}> (DOM element)`;
      snap(li, li + 1, 'create-element',
        `document.createElement('${tag}')\n\nCreates a new <${tag}> DOM element in memory.\n\nThe element exists in memory but is NOT attached to the document yet.\nIt's referenced by the variable "${elVar}".\n\nHeap write #${memOps}: DOM element node allocated.\nListeners: none yet.\nProperties: id, className, textContent = default empty strings.`,
        `CREATE: <${tag}> → ${elVar} | Write #${memOps}`
      );
      li++; continue;
    }

    // const el = document.querySelector('selector')
    const queryM = ln.match(/(?:const|let|var)\s+(\w+)\s*=\s*document\.querySelector\(['"`](.+?)['"`]\)/);
    if (queryM) {
      const [, elVar, sel] = queryM;
      memOps++;
      const tag = sel.replace(/[.#\[\]]/g, '').split(' ')[0] || 'element';
      elements[elVar] = { tag, listeners: [], props: {} };
      vars[elVar] = `<${tag}> (queried from DOM)`;
      snap(li, li + 1, 'query-element',
        `document.querySelector('${sel}')\n\nFinds the first element matching "${sel}" in the DOM.\n\nThe engine scans the document tree depth-first until it finds a match.\nReturns null if no element matches — always check for null in production!\n\nElement "${elVar}" now points to the matched DOM node.`,
        `QUERY: "${sel}" → ${elVar} | Write #${memOps}`
      );
      li++; continue;
    }

    // ── addEventListener ───────────────────────────────────────────────────
    // el.addEventListener('click', handler) or el.addEventListener('click', () => { ... })
    const addEvM = ln.match(/(\w+)\.addEventListener\(['"`](\w+)['"`],\s*(.+?)(?:,\s*(\{[^}]+\}))?\)/);
    if (addEvM) {
      const [, elVar, evType, handlerExpr, optStr] = addEvM;
      const isOnce   = optStr ? optStr.includes('once') && optStr.includes('true') : false;
      const isCapture = optStr ? optStr.includes('capture') && optStr.includes('true') : false;
      const handlerName = handlerExpr.trim().startsWith('(') ? `(anonymous)` : handlerExpr.trim();

      listenersRegistered++;
      memOps++;
      if (elements[elVar]) {
        elements[elVar].listeners.push({ event: evType, handlerName, once: isOnce, capture: isCapture });
      }

      const optDesc = isOnce ? '\n  • once: true — listener auto-removes after first fire\n' : '';
      const captureDesc = isCapture ? '  • capture: true — fires during capture phase (before target)\n' : '';

      snap(li, li + 1, 'add-listener',
        `${elVar}.addEventListener('${evType}', ${handlerName}${optStr ? ', ' + optStr : ''})\n\nRegisters listener #${listenersRegistered} on <${elements[elVar]?.tag || elVar}>.\n\nThe handler is stored in an internal listener list.\nWhen "${evType}" fires on this element, the callback will be called.\n${optDesc}${captureDesc}\nKey: multiple listeners can be registered for the same event type.`,
        `REGISTER: '${evType}' → ${handlerName} | Listeners: ${elements[elVar]?.listeners.length || 1}`
      );
      li++; continue;
    }

    // ── removeEventListener ────────────────────────────────────────────────
    const removeEvM = ln.match(/(\w+)\.removeEventListener\(['"`](\w+)['"`],\s*(.+?)\)/);
    if (removeEvM) {
      const [, elVar, evType, handlerName] = removeEvM;
      if (elements[elVar]) {
        elements[elVar].listeners = elements[elVar].listeners.filter(
          l => !(l.event === evType && l.handlerName === handlerName.trim())
        );
      }
      snap(li, li + 1, 'remove-listener',
        `${elVar}.removeEventListener('${evType}', ${handlerName.trim()})\n\nRemoves the listener for '${evType}' from ${elVar}.\n\nImportant: the handler reference must be the SAME function object.\nPassing a new arrow function won't work — it creates a different reference.\n\nRemoving listeners prevents memory leaks — especially important when:\n  • Components unmount\n  • Elements are removed from the DOM\n  • Single-use listeners complete their purpose`,
        `REMOVE: '${evType}' listener from ${elVar}`
      );
      li++; continue;
    }

    // ── Attribute / property setting ───────────────────────────────────────
    const propSetM = ln.match(/(\w+)\.(\w+)\s*=\s*(.+);?$/);
    if (propSetM && elements[propSetM[1]] && !propSetM[2].startsWith('on')) {
      const [, elVar, prop, val] = propSetM;
      const cleanVal = val.replace(/;$/, '').replace(/^['"`]|['"`]$/g, '');
      memOps++;
      elements[elVar].props[prop] = cleanVal;
      vars[elVar] = `<${elements[elVar].tag} ${prop}="${cleanVal}">`;
      snap(li, li + 1, 'set-prop',
        `${elVar}.${prop} = ${val}\n\nSets the "${prop}" property on <${elements[elVar].tag}>.\n\nDOM properties are live — changing them immediately updates the element.\nHeap write #${memOps}: element node's property slot mutated.`,
        `SET: ${elVar}.${prop} = "${cleanVal}" | Write #${memOps}`
      );
      li++; continue;
    }

    // ── Event dispatch: el.click() ─────────────────────────────────────────
    const clickM = ln.match(/(\w+)\.click\(\)/);
    if (clickM) {
      const elVar = clickM[1];
      eventsDispatched++;
      const el = elements[elVar];
      eventQueue.push(`click on <${el?.tag || elVar}>`);

      snap(li, li + 1, 'dispatch-event',
        `${elVar}.click()\n\nSynthetically dispatches a 'click' MouseEvent on <${el?.tag || elVar}>.\n\nThe event enters the EVENT QUEUE and is immediately processed:\n  1. Capture phase — travels from document → target (top-down)\n  2. Target phase — fires on the target element\n  3. Bubble phase — travels from target → document (bottom-up)\n\nListeners registered for 'click' on this element will now fire.`,
        `DISPATCH: click on ${elVar} | Event queue: [click]`
      );

      // Fire listeners for 'click'
      if (el) {
        eventQueue.pop();
        const clickListeners = el.listeners.filter(l => l.event === 'click');
        for (const listener of clickListeners) {
          callStack.push(listener.handlerName === '(anonymous)' ? 'handler' : listener.handlerName);

          // Scan body lines for the handler
          let handlerOutput = null;
          for (let hli = li + 1; hli < lines.length; hli++) {
            const hln = lines[hli].trim();
            const hLog = hln.match(/console\.log\((.+?)\)/);
            if (hLog) {
              const msg = hLog[1].replace(/^['"`]|['"`]$/g, '');
              handlerOutput = msg;
              output.push(msg);
              break;
            }
          }

          snap(li, li + 1, 'handler-run',
            `LISTENER FIRES: '${listener.event}' on <${el.tag}>\n\nHandler "${listener.handlerName}" is called synchronously.\nA new frame is pushed onto the call stack.\n\nThe event object (e) is passed as the first argument:\n  e.type = "${listener.event}"\n  e.target = <${el.tag}>\n  e.bubbles = true\n${handlerOutput ? '\nconsole.log → "' + handlerOutput + '"' : ''}\n${listener.once ? '\nThis listener has { once: true } — it will be removed after firing.' : ''}`,
            `CALL: ${listener.handlerName} | Stack: [${callStack.join(' → ')}]`
          );

          callStack.pop();

          snap(li, li + 1, 'handler-done',
            `Handler "${listener.handlerName}" returns.\n\nThe call stack frame is popped.\nControl returns to the event dispatch loop.\n\n${listener.once ? '{ once: true } — listener auto-removed from registry.' : 'Listener remains registered for future events.'}`,
            `RETURN: ${listener.handlerName} done | Stack: [${callStack.join(' → ')}]`
          );

          if (listener.once) {
            el.listeners = el.listeners.filter(l => l !== listener);
          }
        }
      }
      li++; continue;
    }

    // ── dispatchEvent(new Event / CustomEvent) ────────────────────────────
    const dispatchM = ln.match(/(\w+)\.dispatchEvent\(new\s+(\w+)\(['"`](\w+)['"`](?:,\s*(.+))?\)\)/);
    if (dispatchM) {
      const [, elVar, EventCtor, evType, detailStr] = dispatchM;
      eventsDispatched++;
      const el = elements[elVar];
      const hasDetail = !!detailStr;
      eventQueue.push(`${evType} on <${el?.tag || elVar}>`);

      snap(li, li + 1, 'dispatch-custom',
        `dispatchEvent(new ${EventCtor}('${evType}'${detailStr ? ', ' + detailStr : ''}))\n\nDispatches a custom '${evType}' event on <${el?.tag || elVar}>.\n\n${EventCtor === 'CustomEvent' ? `CustomEvent allows passing arbitrary data via the "detail" property:\n  e.detail = ${detailStr || '{}'}\n\n` : ''}The event goes through the standard DOM event lifecycle:\n  Capture → Target → Bubble\n\nListeners registered for '${evType}' on this element will fire.`,
        `DISPATCH: ${evType} on ${elVar} | Custom: ${EventCtor}`
      );

      if (el) {
        eventQueue.pop();
        const evListeners = el.listeners.filter(l => l.event === evType);
        for (const listener of evListeners) {
          callStack.push(listener.handlerName === '(anonymous)' ? 'handler' : listener.handlerName);
          snap(li, li + 1, 'handler-run',
            `LISTENER FIRES: '${evType}' on <${el.tag}>\n\nHandler "${listener.handlerName}" called.\n${hasDetail ? `\ne.detail = ${detailStr}` : ''}\n\nCustom events are useful for:\n  • Component communication\n  • Decoupling producers from consumers\n  • Building event-driven architectures`,
            `CALL: ${listener.handlerName} | '${evType}' event`
          );
          callStack.pop();
          if (listener.once) el.listeners = el.listeners.filter(l => l !== listener);
        }
      }
      li++; continue;
    }

    // ── console.log (top-level) ────────────────────────────────────────────
    const logM = ln.match(/console\.log\((.+?)\)/);
    if (logM) {
      const arg = logM[1].trim();
      const val = vars[arg] !== undefined ? vars[arg] : arg.replace(/^['"`]|['"`]$/g, '');
      output.push(String(val));
      snap(li, li + 1, 'log',
        `console.log(${arg})\n\nLogs value to the console.\n\n${arg}: ${val}`,
        `OUTPUT: "${val}"`
      );
      li++; continue;
    }

    li++;
  }

  snap(lines.length - 1, -1, 'done',
    `Event listener simulation complete.\n\n${listenersRegistered} listener${listenersRegistered !== 1 ? 's' : ''} registered\n${eventsDispatched} event${eventsDispatched !== 1 ? 's' : ''} dispatched\n${memOps} memory writes\n${output.length > 0 ? 'Output: ' + output.map(o => '"' + o + '"').join(', ') : 'No console output'}\n\nEvent queue: empty.\nAll listeners have run. Engine idle.`,
    `DONE | ${listenersRegistered} listeners | ${eventsDispatched} events`
  );

  return steps;
}
