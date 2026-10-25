import { useEffect, useState } from 'react'
import DeleteFieldGroupDialog from './components/DeleteFieldGroupDialog.jsx'
import FieldGroupForm from './components/FieldGroupForm.jsx'
import FieldGroupTable from './components/FieldGroupTable.jsx'
import {
  createFieldGroup,
  deleteFieldGroup,
  listFieldGroups,
  updateFieldGroup,
} from './services/fieldGroupService'

export default function FieldGroupsPage() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [feedback, setFeedback] = useState(null)

  const [formTarget, setFormTarget] = useState(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let active = true
    listFieldGroups()
      .then((records) => {
        if (!active) return
        setGroups(records)
        setLoadError('')
      })
      .catch((error) => {
        if (active) setLoadError(error.message || 'Could not load Field Groups.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reload])

  function refresh() {
    setLoading(true)
    setReload((current) => current + 1)
  }

  const suggestedSortOrder = (groups.length ? Math.max(...groups.map((group) => group.sortOrder)) : 0) + 10

  function openCreate() {
    setFormError('')
    setFormTarget({ mode: 'create' })
  }

  function openEdit(group) {
    setFormError('')
    setFormTarget({ mode: 'edit', group })
  }

  async function handleSubmit(values) {
    setSaving(true)
    setFormError('')
    try {
      if (formTarget.mode === 'edit') {
        await updateFieldGroup(formTarget.group.id, values)
        setFeedback({ type: 'success', text: `${values.name.trim()} was updated.` })
      } else {
        await createFieldGroup(values)
        setFeedback({ type: 'success', text: `${values.name.trim()} was created.` })
      }
      setFormTarget(null)
      refresh()
    } catch (error) {
      setFormError(error.message || 'The Field Group could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteFieldGroup(deleteTarget.id)
      setFeedback({ type: 'success', text: `${deleteTarget.name} was deleted.` })
      setDeleteTarget(null)
      refresh()
    } catch (error) {
      setDeleteError(error.message || 'The Field Group could not be deleted.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="product-config-page" aria-labelledby="field-groups-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / PRODUCT CONFIGURATION STUDIO</p>
          <h1 id="field-groups-title">Field Groups</h1>
          <p className="dashboard-intro">Organise global fields into reusable groups.</p>
        </div>
        <button className="store-btn store-btn-approve" disabled={loading || Boolean(loadError)} onClick={openCreate} type="button">
          Create Field Group
        </button>
      </div>

      {feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role="status">{feedback.text}</p>}

      {loading ? (
        <p className="store-state" role="status">Loading Field Groups...</p>
      ) : loadError ? (
        <div className="store-state store-state-error" role="alert">
          <p>Could not load Field Groups: {loadError}</p>
          <button className="store-btn" onClick={refresh} type="button">Retry</button>
        </div>
      ) : groups.length === 0 ? (
        <p className="store-state">No Field Groups have been created yet.</p>
      ) : (
        <FieldGroupTable
          groups={groups}
          onDelete={(group) => {
            setDeleteError('')
            setDeleteTarget(group)
          }}
          onEdit={openEdit}
        />
      )}

      {formTarget && (
        <FieldGroupForm
          error={formError}
          group={formTarget.group}
          onCancel={() => setFormTarget(null)}
          onSubmit={handleSubmit}
          saving={saving}
          suggestedSortOrder={suggestedSortOrder}
        />
      )}

      {deleteTarget && (
        <DeleteFieldGroupDialog
          deleting={deleting}
          error={deleteError}
          group={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </section>
  )
}
