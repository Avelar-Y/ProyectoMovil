declare module '@react-native-community/datetimepicker' {
  import * as React from 'react';
  import { ViewProps } from 'react-native';

  export type Display = 'default' | 'spinner' | 'calendar' | 'clock' | 'inline';

  export interface DateTimePickerProps extends ViewProps {
    value: Date;
    mode?: 'date' | 'time' | 'datetime';
    display?: Display;
    onChange?: (event: any, date?: Date | undefined) => void;
    minimumDate?: Date;
    maximumDate?: Date;
    is24Hour?: boolean;
  }

  const DateTimePicker: React.ComponentType<DateTimePickerProps>;
  export default DateTimePicker;
}
