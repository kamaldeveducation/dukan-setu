+8/**
 * @typedef {'active' | 'inactive'} FieldGroupStatus
 *
 * @typedef {Object} FieldGroup
 * @property {string} id Permanent Firestore document ID (never changes, even if the key changes).
 * @property {string} name
 * @property {string} key Unique, human-readable key (lowercase letters, numbers, underscores).
 * @property {string} description
 * @property {FieldGroupStatus} status
 * @property {number} sortOrder
 * @property {Date | null} createdAt
 * @property {Date | null} updatedAt
 *
 * @typedef {Object} FieldGroupFormValues
 * @property {string} name
 * @property {string} key
 * @property {string} description
 * @property {FieldGroupStatus} status
 * @property {string | number} sortOrder
 */

export const FIELD_GROUPS_COLLECTION = 'global_field_groups'
// One document per key (ID = key); a transaction claims it together with the group, so concurrent writers cannot create duplicates.
export const FIELD_GROUP_KEYS_COLLECTION = 'global_field_group_keys'

export const FIELD_GROUP_STATUS = { active: 'active', inactive: 'inactive' }
export const FIELD_GROUP_STATUS_LABELS = { active: 'Active', inactive: 'Inactive' }

export const FIELD_GROUP_LIMITS = { name: 80, key: 50, description: 300 }
export const FIELD_GROUP_KEY_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/
