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

    const hasValueOnMount = useRef(false);
    const userModified = useRef(false);
    const initialized = useRef(false);

    useEffect(() => {
      if (!initialized.current) {
        initialized.current = true;
        if (field.value) {
          hasValueOnMount.current = true;
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Determine whether auto-generation should run right now
    const shouldAutoGenerate = () => {
      // User manually edited the slug and that setting is enabled
      if (stopOnManualEdit && userModified.current) return false;

      if (hasValueOnMount.current) {
        // Existing entry with a slug value
        if (preserveOnEdit) return false;
      } else if (!hasValueOnMount.current && initialized.current) {
        // Either a new entry or an existing entry with an empty slug
        const isNewEntry = !hasValueOnMount.current;

        if (isNewEntry && !autoGenerateOnCreate) return false;

        // For existing entries with empty slug, check autoGenerateIfEmpty
        // We can't perfectly distinguish "new" from "existing with empty slug"
        // from the client alone, but autoGenerateIfEmpty covers both when
        // autoGenerateOnCreate is also true. If autoGenerateOnCreate is false
        // but autoGenerateIfEmpty is true, we still generate (since the slug IS empty).
        // The only case we block is when both are false.
        if (!autoGenerateOnCreate && !autoGenerateIfEmpty) return false;
      }

      return true;
    };

    // Auto-generate slug from source field in real-time
    useEffect(() => {
      if (sourceFieldName && shouldAutoGenerate()) {
        const newSlug = sourceField.value ? slugify(sourceField.value) : '';
        if (newSlug !== field.value) {
          field.onChange(name, newSlug);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceField.value]);

    const handleChange = (e) => {
      userModified.current = true;
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
