import React from 'react';
import { useIntl } from 'react-intl';
import { Field, SingleSelect, SingleSelectOption } from '@strapi/design-system';

const SelectSourceField = ({
  contentTypeSchema,
  name,
  value,
  onChange,
  intlLabel,
  description,
  error,
  required,
  disabled,
}) => {
  const { formatMessage } = useIntl();

  const attributes = contentTypeSchema?.attributes || [];

  // Only show string and text fields, excluding other custom fields
  const textFields = attributes.filter(
    (attr) => (attr.type === 'string' || attr.type === 'text') && !attr.customField
  );

  const label = intlLabel?.id ? formatMessage(intlLabel) : 'Source field';

  const hint = description?.id ? formatMessage(description) : '';

  return (
    <Field.Root name={name} id={name} error={error} hint={hint} required={required}>
      <Field.Label>{label}</Field.Label>
      <SingleSelect
        disabled={disabled}
        onChange={(selectedValue) => {
          onChange({ target: { name, value: selectedValue, type: 'select' } });
        }}
        placeholder="Select a text field"
        value={value}
      >
        {textFields.map((attr) => (
          <SingleSelectOption key={attr.name} value={attr.name}>
            {attr.name}
          </SingleSelectOption>
        ))}
      </SingleSelect>
      <Field.Hint />
      <Field.Error />
    </Field.Root>
  );
};

export default SelectSourceField;
