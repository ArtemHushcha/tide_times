import '@testing-library/jest-dom';

// Mock Stimulus application
import { Application } from '@hotwired/stimulus';
window.Stimulus = Application.start();

// Mock fetch for API requests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);

// Mock console.error to detect unhandled promise rejections
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0] && args[0].includes('UnhandledPromiseRejectionWarning')) {
    throw new Error(`Unhandled promise rejection: ${args[0]}`);
  }
  originalConsoleError(...args);
};

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserver;
