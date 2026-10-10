import { useEffect, useMemo, useRef, useState } from 'react'
import { getBusinessType } from '../services/businessTypeService'
import { getUserProfile, setStoreApplicationStatus, subscribeToAllStores } from '../services/storeService'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

function formatDate(value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : null
  return date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function timeValue(value) {
  return typeof value?.toMillis === 'function' ? value.toMillis() : 0
}

function normalize(store) {
  return {
    ...store,
    displayName: store.storeName || store.id,
    displayMobile: store.ownerMobile || store.businessMobile || '',
    displayEmail: store.ownerEmail || store.businessEmail || '',
    typeName: getBusinessType(store.businessType)?.name || store.businessType || '—',
  }
}

function StatusBadge({ status }) {
  return <span className={`store-status store-status-${status || 'unknown'}`}>{status || 'unknown'}</span>
}

function DetailRow({ label, value }) {
  return (
    <div className="store-detail-row">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}

export default function AdminStores() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [ownerResult, setOwner] = useState({ uid: null, data: null })
  const [confirm, setConfirm] = useState(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    const unsubscribe = subscribeToAllStores(
      (records) => {
        setStores(records.map(normalize))
        setLoadError('')
        setLoading(false)
      },
      (error) => {
        setLoadError(error.message || 'Could not load stores.')
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  const detailStore = stores.find((store) => store.id === detailId) || null
  const detailOwnerUid = detailStore?.ownerUid
  const owner = {
    data: ownerResult.uid === detailOwnerUid ? ownerResult.data : null,
    loading: Boolean(detailOwnerUid) && ownerResult.uid !== detailOwnerUid,
  }

  useEffect(() => {
    if (!detailOwnerUid) return undefined
    let active = true
    getUserProfile(detailOwnerUid)
      .then((data) => active && setOwner({ uid: detailOwnerUid, data }))
      .catch(() => active && setOwner({ uid: detailOwnerUid, data: null }))
    return () => {
      active = false
    }
  }, [detailOwnerUid])

  const counts = useMemo(() => ({
    all: stores.length,
    pending: stores.filter((store) => store.status === 'pending').length,
    approved: stores.filter((store) => store.status === 'approved').length,
    rejected: stores.filter((store) => store.status === 'rejected').length,
  }), [stores])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return stores
      .filter((store) => filter === 'all' || store.status === filter)
      .filter((store) => !term || [store.displayName, store.ownerName, store.displayEmail, store.ownerEmail, store.businessEmail, store.ownerMobile, store.businessMobile]
        .some((value) => String(value || '').toLowerCase().includes(term)))
      .sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt))
  }, [stores, filter, search])

  function openConfirm(store, action) {
    setFeedback(null)
    setReason('')
    setConfirm({ storeId: store.id, name: store.displayName, action })
  }

  async function submitConfirm() {
    if (submittingRef.current || !confirm) return
    if (confirm.action === 'rejected' && !reason.trim()) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      await setStoreApplicationStatus(confirm.storeId, confirm.action)
      setFeedback({ type: 'success', text: `${confirm.name} was ${confirm.action}.` })
      setConfirm(null)
    } catch (error) {
      setFeedback({ type: 'error', text: error.message || 'The update failed.' })
      setConfirm(null)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function renderActions(store, { showView = true, children = null } = {}) {
    return (
      <div className="store-actions">
        {showView && <button className="store-btn" onClick={() => setDetailId(store.id)} type="button">View details</button>}
        {store.status !== 'approved' && (
          <button className="store-btn store-btn-approve" onClick={() => openConfirm(store, 'approved')} type="button">Approve</button>
        )}
        {store.status === 'pending' && (
          <button className="store-btn store-btn-reject" onClick={() => openConfirm(store, 'rejected')} type="button">Reject</button>
        )}
        {children}
      </div>
    )
  }

  return (
    <section className="admin-stores" aria-labelledby="stores-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">DUKAN SETU / STORES</p>
          <h1 id="stores-title">Store applications</h1>
          <p className="dashboard-intro">Review store registrations and manage approval status.</p>
        </div>
      </div>

      <div className="store-summary">
        <div><span>Total Stores</span><strong>{counts.all}</strong></div>
        <div><span>Pending Applications</span><strong>{counts.pending}</strong></div>
        <div><span>Approved Stores</span><strong>{counts.approved}</strong></div>
        <div><span>Rejected Applications</span><strong>{counts.rejected}</strong></div>
      </div>

      {feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role="status">{feedback.text}</p>}

      <div className="store-toolbar">
        <div className="store-tabs" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((item) => (
            <button
              aria-selected={filter === item.key}
              className={filter === item.key ? 'active' : ''}
              key={item.key}
              onClick={() => setFilter(item.key)}
              role="tab"
              type="button"
            >
              {item.label} ({counts[item.key]})
            </button>
          ))}
        </div>
        <input
          aria-label="Search stores"
          className="store-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search store, owner, email or mobile"
          type="search"
          value={search}
        />
      </div>

      {loading ? (
        <p className="store-state">Loading stores...</p>
      ) : loadError ? (
        <p className="store-state store-state-error" role="alert">Could not load stores: {loadError}</p>
      ) : visible.length === 0 ? (
        <p className="store-state">{stores.length === 0 ? 'No store applications yet.' : 'No stores match your filters.'}</p>
      ) : (
        <>
          <table className="store-table">
            <thead>
              <tr><th>Store</th><th>Owner</th><th>Type</th><th>Contact</th><th>Registered</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {visible.map((store) => (
                <tr key={store.id}>
                  <td><strong>{store.displayName}</strong></td>
                  <td>{store.ownerName || '—'}</td>
                  <td>{store.typeName}</td>
                  <td>{store.displayMobile || '—'}<br /><small>{store.displayEmail}</small></td>
                  <td>{formatDate(store.createdAt)}</td>
                  <td><StatusBadge status={store.status} /></td>
                  <td>{renderActions(store)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="store-cards">
            {visible.map((store) => (
              <li key={store.id}>
                <div className="store-card-head"><strong>{store.displayName}</strong><StatusBadge status={store.status} /></div>
                <p>{store.ownerName || '—'} · {store.typeName}</p>
                <p>{store.displayMobile || '—'}</p>
                <p>{store.displayEmail}</p>
                <p><small>Registered {formatDate(store.createdAt)}</small></p>
                {renderActions(store)}
              </li>
            ))}
          </ul>
        </>
      )}

      {detailStore && (
        <div className="store-modal-backdrop" onClick={() => setDetailId(null)} role="presentation">
          <div aria-label="Store details" aria-modal="true" className="store-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <h2>{detailStore.displayName}</h2>
            <StatusBadge status={detailStore.status} />
            <dl>
              <DetailRow label="Store ID" value={detailStore.id} />
              <DetailRow label="Business type" value={detailStore.typeName} />
              <DetailRow label="Category" value={detailStore.businessCategory} />
              <DetailRow label="Owner name" value={detailStore.ownerName || owner.data?.displayName || owner.data?.name} />
              <DetailRow label="Owner UID" value={detailStore.ownerUid} />
              <DetailRow label="Owner mobile" value={detailStore.ownerMobile || owner.data?.mobile || owner.data?.phoneNumber} />
              <DetailRow label="Owner email" value={detailStore.ownerEmail || owner.data?.email} />
              <DetailRow label="Business mobile" value={detailStore.businessMobile} />
              <DetailRow label="Business email" value={detailStore.businessEmail} />
              <DetailRow label="Address" value={[detailStore.address, detailStore.city, detailStore.state, detailStore.pincode].filter(Boolean).join(', ')} />
              <DetailRow label="Registered" value={formatDate(detailStore.createdAt)} />
            </dl>
            {owner.loading && <small>Loading owner profile...</small>}
            {renderActions(detailStore, {
              showView: false,
              children: <button className="store-btn" onClick={() => setDetailId(null)} type="button">Close</button>,
            })}
          </div>
        </div>
      )}

      {confirm && (
        <div className="store-modal-backdrop" role="presentation">
          <div aria-modal="true" className="store-modal" role="alertdialog" aria-labelledby="store-confirm-title">
            <h2 id="store-confirm-title">{confirm.action === 'approved' ? 'Approve' : 'Reject'} store?</h2>
            <p>{confirm.name} will be marked as {confirm.action}.</p>
            {confirm.action === 'rejected' && (
              <>
                <label htmlFor="store-reject-reason">Reason for rejection (required)</label>
                <textarea id="store-reject-reason" onChange={(event) => setReason(event.target.value)} rows={3} value={reason} />
                <small>Note: the reason is not saved, because the store data model has no field for it.</small>
              </>
            )}
            <div className="store-actions">
              <button className="store-btn" disabled={submitting} onClick={() => setConfirm(null)} type="button">Cancel</button>
              <button
                className={`store-btn ${confirm.action === 'approved' ? 'store-btn-approve' : 'store-btn-reject'}`}
                disabled={submitting || (confirm.action === 'rejected' && !reason.trim())}
                onClick={submitConfirm}
                type="button"
              >
                {submitting ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
