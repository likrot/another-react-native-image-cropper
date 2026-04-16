// Canonical Reanimated 4 + Worklets test setup.
//
// `react-native-worklets/jest/resolver` (configured in package.json's
// `jest.resolver`) swaps the native worklets module for its web
// implementation, so `setUpTests()` can register reanimated's jest mocks
// without any manual stubbing on our side.
//
// Reference:
//   https://docs.swmansion.com/react-native-reanimated/docs/guides/testing
//   https://docs.swmansion.com/react-native-worklets/docs/guides/testing
require('react-native-reanimated').setUpTests();

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    ...jest.requireActual('react-native-safe-area-context'),
    SafeAreaProvider: jest.fn(({ children }) => children),
    SafeAreaView: jest.fn(({ children }) => children),
    useSafeAreaInsets: jest.fn(() => inset),
  };
});
