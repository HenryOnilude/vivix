// @vitest-environment happy-dom
/**
 * Component tests for Home.svelte
 * Run: npm test
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import Home from './Home.svelte';

describe('Home.svelte', () => {
  afterEach(() => cleanup());

  it('renders the main heading', () => {
    render(Home);
    expect(screen.getByText('JS')).toBeTruthy();
  });

  it('renders the tagline', () => {
    render(Home);
    expect(screen.getByText(/Watch it think/)).toBeTruthy();
  });

  it('renders all module cards plus hero features', () => {
    render(Home);
    const cards = screen.getAllByRole('listitem');
    // 3 hero feature bullets + 9 module cards = 12
    expect(cards.length).toBe(12);
  });

  it('renders correct module titles', () => {
    render(Home);
    expect(screen.getByText('varStore')).toBeTruthy();
    expect(screen.getByText('ifGate')).toBeTruthy();
    expect(screen.getByText('forLoop')).toBeTruthy();
    expect(screen.getByText('fnCall')).toBeTruthy();
    expect(screen.getByText('arrayFlow')).toBeTruthy();
    expect(screen.getByText('objExplorer')).toBeTruthy();
    expect(screen.getByText('dataStruct')).toBeTruthy();
    expect(screen.getByText('asyncFlow')).toBeTruthy();
    expect(screen.getByText('closureScope')).toBeTruthy();
  });

  it('each card links to the correct hash route', () => {
    render(Home);
    const links = screen.getAllByRole('link');
    const hrefs = links.map(l => l.getAttribute('href'));
    expect(hrefs).toContain('#/variables');
    expect(hrefs).toContain('#/if-gate');
    expect(hrefs).toContain('#/for-loop');
    expect(hrefs).toContain('#/function');
    expect(hrefs).toContain('#/array');
    expect(hrefs).toContain('#/objects');
    expect(hrefs).toContain('#/data-structures');
    expect(hrefs).toContain('#/async');
    expect(hrefs).toContain('#/closures');
  });

  it('renders the demo progress bar', () => {
    render(Home);
    // The demo section has a progress bar — verify it exists
    expect(document.querySelector('.demo-progress-track')).toBeTruthy();
  });

  it('renders module descriptions', () => {
    render(Home);
    expect(screen.getByText('Watch the CPU store values in memory.')).toBeTruthy();
    expect(screen.getByText('See how true and false control the flow.')).toBeTruthy();
  });
});
