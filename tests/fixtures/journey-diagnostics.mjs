// Failure-only browser evidence. No retries, delays or assertion changes.
export async function observeJourney(page) {
  await page.evaluateOnNewDocument(() => {
    window.__journeyEvents = [];
    for (const type of ['click', 'focusin']) document.addEventListener(type, event => {
      const target = event.target.closest('button,input,a') || event.target;
      window.__journeyEvents.push({ type, time: performance.now(), target: target.outerHTML.slice(0, 350), x: event.clientX, y: event.clientY });
      if (window.__journeyEvents.length > 30) window.__journeyEvents.shift();
    }, true);
  });
}
export async function reportJourneyFailure(browser) {
  for (const page of await browser?.pages() || []) {
    try {
      console.error('JOURNEY FAILURE', JSON.stringify(await page.evaluate(() => ({
        url: location.href, visibility: document.visibilityState,
        events: window.__journeyEvents, fonts: document.fonts.status,
        active: document.activeElement?.outerHTML.slice(0, 350),
        generate: document.querySelector('.gen')?.outerHTML,
        hint: document.querySelector('.demohint')?.textContent,
        name: document.querySelector('#f-name')?.value,
        alerts: [...document.querySelectorAll('[role=alertdialog]')].map(e => e.textContent),
        text: document.body.innerText.slice(-2500)
      }))));
    } catch (error) { console.error('Journey evidence unavailable', error.message); }
  }
}
