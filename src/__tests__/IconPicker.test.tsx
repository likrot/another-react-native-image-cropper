import { fireEvent, render } from '@testing-library/react-native';

import { IconPicker, type IconPickerItem } from '../components/ui/IconPicker';

const items: IconPickerItem[] = [
  { id: 'a', icon: 'square', label: 'A' },
  { id: 'b', icon: 'circle', label: 'B' },
  { id: 'c', icon: 'heart', label: 'C' },
  { id: 'd', icon: 'star', label: 'D' },
];

describe('IconPicker', () => {
  it('renders all items inline when count <= max and shows no chevron', () => {
    const onChange = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <IconPicker
        items={items.slice(0, 2)}
        value="a"
        onChange={onChange}
        max={2}
      />
    );
    expect(getByLabelText('A')).toBeTruthy();
    expect(getByLabelText('B')).toBeTruthy();
    expect(queryByLabelText('Show more options')).toBeNull();
    expect(queryByLabelText('Collapse options')).toBeNull();
  });

  it('fires onChange with the chosen id', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <IconPicker
        items={items.slice(0, 2)}
        value="a"
        onChange={onChange}
        max={2}
      />
    );
    fireEvent.press(getByLabelText('B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('renders the chevron in collapsed state when count > max', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <IconPicker items={items} value="a" onChange={onChange} max={2} />
    );
    const chevron = getByLabelText('Show more options');
    expect(chevron).toBeTruthy();
    expect(chevron.props.accessibilityState).toMatchObject({ expanded: false });
  });

  it('toggles the chevron label + accessibility state on tap', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <IconPicker items={items} value="a" onChange={onChange} max={2} />
    );
    fireEvent.press(getByLabelText('Show more options'));
    const chevron = getByLabelText('Collapse options');
    expect(chevron.props.accessibilityState).toMatchObject({ expanded: true });
    fireEvent.press(chevron);
    expect(
      getByLabelText('Show more options').props.accessibilityState
    ).toMatchObject({ expanded: false });
  });

  it('keeps overflow items mounted so they can animate in and out', () => {
    // All items are present in the tree regardless of expanded state — the
    // collapse uses width/opacity animation, not mount/unmount.
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <IconPicker items={items} value="a" onChange={onChange} max={2} />
    );
    expect(getByLabelText('A')).toBeTruthy();
    expect(getByLabelText('B')).toBeTruthy();
    expect(getByLabelText('C')).toBeTruthy();
    expect(getByLabelText('D')).toBeTruthy();
  });

  it('auto-collapses after picking an overflow item', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <IconPicker items={items} value="a" onChange={onChange} max={2} />
    );
    fireEvent.press(getByLabelText('Show more options'));
    expect(getByLabelText('Collapse options')).toBeTruthy();
    fireEvent.press(getByLabelText('C'));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(getByLabelText('Show more options')).toBeTruthy();
  });
});
