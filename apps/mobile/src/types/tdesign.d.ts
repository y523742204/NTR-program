declare namespace JSX {
  interface IntrinsicElements {
    't-icon': {
      color?: string;
      name:
        | 'browse'
        | 'calendar-1'
        | 'calendar-2'
        | 'chat'
        | 'close'
        | 'chevron-down'
        | 'chevron-left'
        | 'chevron-right'
        | 'city'
        | 'delete'
        | 'drag-move'
        | 'edit-1'
        | 'gender-female'
        | 'gender-male'
        | 'location'
        | 'notification'
        | 'add'
        | 'search'
        | 'save'
        | 'send'
        | 'tag'
        | 'task-time'
        | 'time'
        | 'user'
        | 'usergroup'
        | 'usergroup-add';
      size?: number | string;
      slot?: string;
      't-class'?: string;
    };
    't-loading': {
      loading?: boolean;
      size?: string;
      text?: string;
      theme?: 'circular' | 'spinner' | 'dots';
    };
    't-tab-bar': {
      bordered?: boolean;
      children?: React.ReactNode;
      fixed?: boolean;
      safeAreaInsetBottom?: boolean;
      shape?: 'normal' | 'round';
      split?: boolean;
      't-class'?: string;
      theme?: 'normal' | 'tag';
      value?: string | number;
    };
    't-tab-bar-item': {
      badgeProps?: { count?: string | number; maxCount?: number; showZero?: boolean };
      children?: React.ReactNode;
      icon?: string | { color?: string; name: string; size?: number | string };
      linkType?: 'redirectTo' | 'switchTab' | 'reLaunch' | 'navigateTo';
      't-class'?: string;
      url?: string;
      value?: string | number;
    };
    't-stepper': {
      disableInput?: boolean;
      integer?: boolean;
      max?: number;
      min?: number;
      onChange?: (event: { detail: { value: number } }) => void;
      step?: number;
      theme?: 'normal' | 'filled' | 'outline';
      value?: number;
    };
    't-tabs': {
      children?: React.ReactNode;
      onChange?: (event: { detail: { label: string; value: string | number } }) => void;
      theme?: 'line' | 'tag' | 'card';
      value?: string | number;
    };
    't-tab-panel': {
      children?: React.ReactNode;
      key?: React.Key;
      label?: string;
      lazy?: boolean;
      value?: string | number;
    };
    't-toast': {
      id: string;
    };
  }
}
