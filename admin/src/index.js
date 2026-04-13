import { Link as LinkIcon } from '@strapi/icons';
import SelectSourceField from './components/SelectSourceField';

const pluginId = 'auto-slug';

export default {
  register(app) {
    app.customFields.register({
      name: 'slug',
      pluginId,
      type: 'string',
      icon: LinkIcon,
      intlLabel: {
        id: `${pluginId}.label`,
        defaultMessage: 'Auto Slug',
      },
      intlDescription: {
        id: `${pluginId}.description`,
        defaultMessage: 'Automatically generates a URL-friendly slug from a text field',
      },
      components: {
        Input: async () => import('./components/Input'),
      },
      options: {
        base: [
          {
            sectionTitle: null,
            items: [
              {
                intlLabel: {
                  id: `${pluginId}.options.sourceField.label`,
                  defaultMessage: 'Source field',
                },
                description: {
                  id: `${pluginId}.options.sourceField.description`,
                  defaultMessage: 'The text field to generate the slug from',
                },
                name: 'options.sourceField',
                type: 'select-source-field',
              },
            ],
          },
        ],
        advanced: [
          {
            sectionTitle: {
              id: `${pluginId}.options.advanced.behavior`,
              defaultMessage: 'Auto-generation behavior',
            },
            items: [
              {
                name: 'options.autoGenerateOnCreate',
                type: 'checkbox',
                defaultValue: true,
                intlLabel: {
                  id: `${pluginId}.options.autoGenerateOnCreate.label`,
                  defaultMessage: 'Auto-generate slug on creation',
                },
                description: {
                  id: `${pluginId}.options.autoGenerateOnCreate.description`,
                  defaultMessage:
                    'Automatically generate the slug from the source field when creating a new entry',
                },
              },
              {
                name: 'options.stopOnManualEdit',
                type: 'checkbox',
                defaultValue: true,
                intlLabel: {
                  id: `${pluginId}.options.stopOnManualEdit.label`,
                  defaultMessage: 'Stop auto-generation after manual edit',
                },
                description: {
                  id: `${pluginId}.options.stopOnManualEdit.description`,
                  defaultMessage:
                    'Stop auto-generating when the user manually modifies the slug',
                },
              },
              {
                name: 'options.preserveOnEdit',
                type: 'checkbox',
                defaultValue: true,
                intlLabel: {
                  id: `${pluginId}.options.preserveOnEdit.label`,
                  defaultMessage: 'Preserve slug when editing',
                },
                description: {
                  id: `${pluginId}.options.preserveOnEdit.description`,
                  defaultMessage:
                    'Keep the existing slug when editing an entry, even if the source field changes',
                },
              },
              {
                name: 'options.autoGenerateIfEmpty',
                type: 'checkbox',
                defaultValue: true,
                intlLabel: {
                  id: `${pluginId}.options.autoGenerateIfEmpty.label`,
                  defaultMessage: 'Auto-generate for empty slugs on existing entries',
                },
                description: {
                  id: `${pluginId}.options.autoGenerateIfEmpty.description`,
                  defaultMessage:
                    'Auto-generate the slug for existing entries that have an empty slug field',
                },
              },
            ],
          },
          {
            sectionTitle: {
              id: `${pluginId}.options.advanced.settings`,
              defaultMessage: 'Settings',
            },
            items: [
              {
                name: 'required',
                type: 'checkbox',
                intlLabel: {
                  id: `${pluginId}.options.advanced.requiredField`,
                  defaultMessage: 'Required field',
                },
                description: {
                  id: `${pluginId}.options.advanced.requiredField.description`,
                  defaultMessage:
                    "You won't be able to create an entry if this field is empty",
                },
              },
            ],
          },
        ],
      },
    });
  },

  bootstrap(app) {
    const ctbPlugin = app.getPlugin('content-type-builder');
    if (ctbPlugin?.apis?.forms) {
      ctbPlugin.apis.forms.components.add({
        id: 'select-source-field',
        component: SelectSourceField,
      });
    }
  },
};
