import '@testing-library/jest-dom';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => {
  const React = require('react');
  const motion = new Proxy({}, {
    get: (_target: any, prop: string) => {
      return React.forwardRef((props: any, ref: any) => {
        const { initial, animate, exit, transition, whileHover, whileTap, variants, ...rest } = props;
        return React.createElement(prop, { ...rest, ref });
      });
    },
  });
  return {
    __esModule: true,
    motion,
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
    useInView: () => true,
  };
});

if (typeof window !== 'undefined') {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock IntersectionObserver
  class MockIntersectionObserver {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
  });

  // Mock ResizeObserver
  class MockResizeObserver {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  }
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: MockResizeObserver,
  });
}

// Suppress specific console warnings in tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes('Texture load failed')) return;
  originalWarn(...args);
};
