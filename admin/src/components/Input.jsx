import React, { useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Field, TextInput } from '@strapi/design-system';
import { useField } from '@strapi/strapi/admin';

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const Input = React.forwardRef(
  ({ name, required, label, hint, placeholder, disabled, attribute }, ref) => {
    const { formatMessage } = useIntl();
    const field = useField(name);

    const sourceFieldName = attribute?.options?.sourceField;
    const sourceField = useField(sourceFieldName || '');

    // Read behavior options (all default to true when not explicitly set)
    const opts = attribute?.options || {};
    const autoGenerateOnCreate = opts.autoGenerateOnCreate !== false;
    const stopOnManualEdit = opts.stopOnManualEdit !== false;
    const preserveOnEdit = opts.preserveOnEdit !== false;
    const autoGenerateIfEmpty = opts.autoGenerateIfEmpty !== false;

    // Detect create vs edit from the URL (avoids async data-loading timing issues)
    const isCreateMode =
      typeof window !== 'undefined' &&
      window.location.pathname.endsWith('/create');

    // Track whether we (auto-generation) set the slug value
    const weSetSlug = useRef(false);
    // Track whether the user manually edited the slug
    const userModified = useRef(false);

    // Auto-generate slug from source field in real-time
    useEffect(() => {
      if (!sourceFieldName) return;

      // User manually edited — respect stopOnManualEdit
      if (stopOnManualEdit && userModified.current) return;

      if (isCreateMode) {
        // Create mode
        if (!autoGenerateOnCreate) return;
      } else {
        // Edit mode — if slug has a value we didn't set, it came from the DB
        if (field.value && !weSetSlug.current && preserveOnEdit) return;

        // Edit mode — slug is empty
        if (!field.value && !weSetSlug.current && !autoGenerateIfEmpty) return;
      }

      const newSlug = sourceField.value ? slugify(sourceField.value) : '';
      if (newSlug !== field.value) {
        weSetSlug.current = true;
        field.onChange(name, newSlug);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceField.value]);

    const handleChange = (e) => {
      userModified.current = true;
      weSetSlug.current = false;
      field.onChange(name, e.target.value);
    };

    const fieldLabel = label
      ? typeof label === 'object'
        ? formatMessage(label)
        : label
      : 'Auto Slug';

    return (
      <Field.Root
        name={name}
        id={name}
        error={field.error}
        hint={hint}
        required={required}
      >
        <Field.Label>{fieldLabel}</Field.Label>
        <TextInput
          ref={ref}
          name={name}
          value={field.value || ''}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder || 'Slug will be auto-generated'}
        />
        <Field.Hint />
        <Field.Error />
      </Field.Root>
    );
  }
);

export default Input;
