/**
 * Icon override plumbing. Consumers pass an `icons` prop to
 * `ImageCropperModal` whose entries can be either ReactNodes (static
 * overrides) or render functions `(IconRenderProps) => ReactNode`. This
 * module resolves those overrides into a single `renderIcon(name, props)`
 * published via context so internal components don't have to duplicate the
 * lookup logic.
 */

import React, {
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import { type IconName } from '../constants/icons';
import { Icon, type IconRenderProps } from '../components/ui/Icon';

export type IconOverride = ReactNode | ((props: IconRenderProps) => ReactNode);
export type IconOverrideMap = Partial<Record<IconName, IconOverride>>;

interface IconContextValue {
  renderIcon: (name: IconName, props: IconRenderProps) => ReactNode;
}

const defaultRenderIcon = (
  name: IconName,
  props: IconRenderProps
): ReactNode => <Icon name={name} {...props} />;

const IconContext = createContext<IconContextValue>({
  renderIcon: defaultRenderIcon,
});

export interface IconProviderProps {
  overrides?: IconOverrideMap;
  children: ReactNode;
}

export const IconProvider: React.FC<IconProviderProps> = ({
  overrides,
  children,
}) => {
  const value = useMemo<IconContextValue>(
    () => ({
      renderIcon: (name, props) => {
        const override = overrides?.[name];
        if (override === undefined) return defaultRenderIcon(name, props);
        if (typeof override === 'function') return override(props);
        // Static ReactNode — pass through as-is.
        if (isValidElement(override)) return override;
        return override;
      },
    }),
    [overrides]
  );
  return <IconContext.Provider value={value}>{children}</IconContext.Provider>;
};

export const useIconRenderer = (): IconContextValue['renderIcon'] =>
  useContext(IconContext).renderIcon;
