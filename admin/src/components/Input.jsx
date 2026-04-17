import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useIntl } from 'react-intl';
import { Field, TextInput } from '@strapi/design-system';
import { useField, useFetchClient } from '@strapi/strapi/admin';

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

/**
 * Parse the content-type UID and documentId from the current URL.
 * Strapi v5 URLs look like:
 *   /admin/content-manager/collection-types/api::article.article/create
 *   /admin/content-manager/collection-types/api::article.article/<documentId>
 *   /admin/content-manager/single-types/api::homepage.homepage
 */
function parseContentInfo() {
  const path = window.location.pathname;
  const match = path.match(
    /content-manager\/(?:collection-types|single-types)\/([^/]+)(?:\/(.+))?/
  );
  if (!match) return {};
  const uid = match[1];
  const last = match[2];
  const documentId = last && last !== 'create' ? last : undefined;
  return { uid, documentId };
}

const Input = React.forwardRef(
  ({ name, required, label, hint, placeholder, disabled, attribute }, ref) => {
    const { formatMessage } = useIntl();
    const field = useField(name);
    const { post } = useFetchClient();

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
      typeof window !== 'undefined' && window.location.pathname.endsWith('/create');

    // Track whether we (auto-generation) set the slug value
    const weSetSlug = useRef(false);
    // Track whether the user manually edited the slug
    const userModified = useRef(false);
    // Debounce timer for availability check
    const debounceTimer = useRef(null);
    // Track the latest slug we sent to the API to avoid stale responses
    const latestCheck = useRef(null);
    // Duplicate warning message
    const [duplicateWarning, setDuplicateWarning] = useState('');

    const checkAvailability = useCallback(
      (slug) => {
        if (!slug) {
          setDuplicateWarning('');
          return;
        }

        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }

        latestCheck.current = slug;

        debounceTimer.current = setTimeout(async () => {
          try {
            const { uid, documentId } = parseContentInfo();
            if (!uid) return;

            const { data } = await post('/auto-slug/check-availability', {
              slug,
              uid,
              field: name,
              documentId,
            });

            // Only apply if this is still the latest check
            if (latestCheck.current !== slug) return;

            if (!data.available) {
              setDuplicateWarning(`The slug "${slug}" is already being used by another entry`);
              weSetSlug.current = true;
              field.onChange(name, data.suggestion);
            } else {
              setDuplicateWarning('');
            }
          } catch {
            // Silently fail — server-side uniqueness check is the safety net
          }
        }, 300);
      },
      [name, field, post]
    );

    // Clean up debounce timer on unmount
    useEffect(() => {
      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    }, []);

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
        checkAvailability(newSlug);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceField.value]);

    const handleChange = (e) => {
      userModified.current = true;
      weSetSlug.current = false;
      const value = e.target.value;
      field.onChange(name, value);
      checkAvailability(value);
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
        hint={duplicateWarning || hint}
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
        <Field.Hint>
          {duplicateWarning ? <span style={{ color: '#d02b20' }}>{duplicateWarning}</span> : hint}
        </Field.Hint>
        <Field.Error />
      </Field.Root>
    );
  }
);

export default Input;
