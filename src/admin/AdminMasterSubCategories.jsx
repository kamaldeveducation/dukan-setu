import { useEffect, useState } from 'react'
import MasterCategoryImageField from './MasterCategoryImageField.jsx'
import {
	createMasterSubCategory,
	generateMasterSubCategoryCode,
	listMasterSubCategories,
	listSubCategoryParentOptions,
	setMasterSubCategoryActive,
	updateMasterSubCategory,
} from '../services/masterSubCategoryService'
import { listMasterCategoryFilterOptions } from '../services/masterCategoryService'

const emptyForm = { name: '', code: '', parentId: '', businessCategoryRefs: [], sortOrder: '10', active: true }
const statusFilters = ['all', 'active', 'inactive']

function pairKey(businessTypeId, categoryId) {
	return JSON.stringify([businessTypeId, categoryId])
}

function StatusBadge({ active }) {
	return <span className={`store-status store-status-${active ? 'approved' : 'rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
}

function SubCategoryThumbnail({ category, onPreview }) {
	const [failed, setFailed] = useState(false)
	if (!category.imageUrl || failed) {
		return <span aria-label={`${category.name}: no image`} className="master-category-thumbnail-placeholder" role="img" />
	}
	return (
		<button aria-label={`Preview ${category.name} image`} className="master-subcategory-preview-button" onClick={() => onPreview(category)} type="button">
			<img alt={category.name} className="master-category-thumbnail" onError={() => setFailed(true)} src={category.imageUrl} />
		</button>
	)
}

export default function AdminMasterSubCategories() {
	const [categories, setCategories] = useState([])
	const [parents, setParents] = useState([])
	const [businessTypes, setBusinessTypes] = useState([])
	const [options, setOptions] = useState([])
	const [loading, setLoading] = useState(true)
	const [loadError, setLoadError] = useState('')
	const [reload, setReload] = useState(0)

	const [search, setSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState('all')
	const [businessTypeFilter, setBusinessTypeFilter] = useState('')
	const [businessCategoryFilter, setBusinessCategoryFilter] = useState('')
	const [parentFilter, setParentFilter] = useState('')

	const [dialog, setDialog] = useState(null)
	const [form, setForm] = useState(emptyForm)
	const [codeEdited, setCodeEdited] = useState(false)
	const [formError, setFormError] = useState('')
	const [formNotice, setFormNotice] = useState('')
	const [formBusinessTypeId, setFormBusinessTypeId] = useState('')
	const [formBusinessCategoryId, setFormBusinessCategoryId] = useState('')
	const [imageAsset, setImageAsset] = useState(null)
	const [removeImage, setRemoveImage] = useState(false)
	const [uploadProgress, setUploadProgress] = useState(null)
	const [feedback, setFeedback] = useState(null)
	const [saving, setSaving] = useState(false)
	const [busyId, setBusyId] = useState('')
	const [confirmTarget, setConfirmTarget] = useState(null)
	const [previewTarget, setPreviewTarget] = useState(null)

	useEffect(() => {
		let current = true
		Promise.all([listMasterSubCategories(), listSubCategoryParentOptions(), listMasterCategoryFilterOptions()])
			.then(([subCategories, parentRecords, filterOptions]) => {
				if (!current) return
				setCategories(subCategories)
				setParents(parentRecords)
				setBusinessTypes(filterOptions.businessTypes)
				setOptions(filterOptions.categories)
				setLoading(false)
			})
			.catch((error) => {
				if (!current) return
				setLoadError(error.message || 'Could not load Master Sub Categories and catalog options.')
				setLoading(false)
			})
		return () => { current = false }
	}, [reload])

	const parentById = new Map(parents.map((parent) => [parent.id, parent]))
	const optionByKey = new Map(options.map((option) => [pairKey(option.businessTypeId, option.categoryId), option]))
	const term = search.trim().toLocaleLowerCase()
	const selectedCategoryRef = businessCategoryFilter ? JSON.parse(businessCategoryFilter) : null
	const matchingCategories = categories.filter((category) => {
		const refs = category.businessCategoryRefs
		const matchesType = !businessTypeFilter || refs.some((ref) => ref.businessTypeId === businessTypeFilter)
		const matchesCategory = !selectedCategoryRef || refs.some((ref) => (
			ref.businessTypeId === selectedCategoryRef[0] && ref.categoryId === selectedCategoryRef[1]
		))
		const matchesParent = !parentFilter || category.parentId === parentFilter
		const matchesSearch = !term || [category.name, category.code]
			.some((value) => String(value || '').toLocaleLowerCase().includes(term))
		return matchesType && matchesCategory && matchesParent && matchesSearch
	})
	const validMappingCount = (category) => {
		const parent = parentById.get(category.parentId)
		const parentKeys = new Set((parent?.businessCategoryRefs || []).map((ref) => pairKey(ref.businessTypeId, ref.categoryId)))
		return category.businessCategoryRefs.filter((ref) => parentKeys.has(pairKey(ref.businessTypeId, ref.categoryId))
			&& optionByKey.has(pairKey(ref.businessTypeId, ref.categoryId))).length
	}
	const counts = {
		all: matchingCategories.length,
		active: matchingCategories.filter((category) => category.active === true).length,
		inactive: matchingCategories.filter((category) => category.active !== true).length,
		unmapped: matchingCategories.filter((category) => validMappingCount(category) === 0).length,
	}
	const visibleCategories = matchingCategories.filter((category) => (
		statusFilter === 'all' || (statusFilter === 'active' ? category.active === true : category.active !== true)
	))
	const formParent = dialog ? parentById.get(form.parentId) : null
	const editingSubCategory = dialog?.mode === 'edit' ? categories.find((category) => category.id === dialog.id) : null
	const savedMappingKeys = new Set((editingSubCategory?.businessCategoryRefs || []).map((ref) => pairKey(ref.businessTypeId, ref.categoryId)))
	const activeBusinessTypes = businessTypes.filter((type) => type.active === true)
	const savedBusinessType = businessTypes.find((type) => type.id === formBusinessTypeId && type.active !== true
		&& [...savedMappingKeys].some((key) => JSON.parse(key)[0] === type.id))
	const formBusinessTypes = savedBusinessType ? [...activeBusinessTypes, savedBusinessType] : activeBusinessTypes
	const formCategoriesForType = options.filter((option) => option.businessTypeId === formBusinessTypeId
		&& (option.active === true || savedMappingKeys.has(pairKey(option.businessTypeId, option.categoryId))))
	const selectedPairKey = formBusinessTypeId && formBusinessCategoryId
		? pairKey(formBusinessTypeId, formBusinessCategoryId)
		: ''
	const activeMasterCategoryOptions = selectedPairKey
		? parents.filter((parent) => parent.active === true
			&& parent.businessCategoryRefs.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === selectedPairKey))
		: []
	const savedInactiveParent = selectedPairKey && formParent?.active !== true
		&& formParent?.businessCategoryRefs.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === selectedPairKey)
		? formParent
		: null
	const masterCategoryOptions = savedInactiveParent
		? [...activeMasterCategoryOptions, savedInactiveParent]
		: activeMasterCategoryOptions

	function resetFormState() {
		setFormError('')
		setFormNotice('')
		setImageAsset(null)
		setRemoveImage(false)
		setUploadProgress(null)
		setFormBusinessTypeId('')
		setFormBusinessCategoryId('')
	}

	function openCreate() {
		const orders = categories.map((category) => Number(category.sortOrder) || 0)
		setForm({ ...emptyForm, sortOrder: String((orders.length ? Math.max(...orders) : 0) + 10) })
		setCodeEdited(false)
		resetFormState()
		setDialog({ mode: 'create' })
	}

	function openEdit(category) {
		setForm({
			name: category.name || '',
			code: category.code || category.id,
			parentId: category.parentId || '',
			businessCategoryRefs: category.businessCategoryRefs.map(({ businessTypeId, categoryId }) => ({ businessTypeId, categoryId })),
			sortOrder: String(category.sortOrder ?? 0),
			active: category.active === true,
		})
		setCodeEdited(true)
		resetFormState()
		setFormBusinessTypeId(category.businessCategoryRefs[0]?.businessTypeId || '')
		setFormBusinessCategoryId(category.businessCategoryRefs[0]?.categoryId || '')
		setDialog({ mode: 'edit', id: category.id })
	}

	function changeBusinessType(businessTypeId) {
		setFormBusinessTypeId(businessTypeId)
		setFormBusinessCategoryId('')
		setForm((current) => ({ ...current, parentId: '', businessCategoryRefs: [] }))
		setFormNotice('')
	}

	function changeBusinessCategory(categoryId) {
		setFormBusinessCategoryId(categoryId)
		setForm((current) => ({ ...current, parentId: '', businessCategoryRefs: [] }))
		setFormNotice('')
	}

	function changeMasterCategory(parentId) {
		const parent = parentById.get(parentId)
		const allowedKeys = new Set((parent?.businessCategoryRefs || []).map((ref) => pairKey(ref.businessTypeId, ref.categoryId)))
		const validRefs = form.businessCategoryRefs.filter((ref) => allowedKeys.has(pairKey(ref.businessTypeId, ref.categoryId)))
		if (parentId && selectedPairKey && !validRefs.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === selectedPairKey)) {
			validRefs.push({ businessTypeId: formBusinessTypeId, categoryId: formBusinessCategoryId })
		}
		setFormNotice('')
		setForm((current) => ({ ...current, parentId, businessCategoryRefs: validRefs }))
	}

	async function submitForm(event) {
		event.preventDefault()
		if (saving) return
		if (!formBusinessTypeId) {
			setFormError('Select a Business Type.')
			return
		}
		if (!formBusinessCategoryId) {
			setFormError('Select a Business Category.')
			return
		}
		if (!form.parentId) {
			setFormError('Select a Master Category mapping for this Business Category.')
			return
		}
		if (form.businessCategoryRefs.length === 0) {
			setFormError('Add at least one Business Category mapping before saving.')
			return
		}
		setSaving(true)
		setFormError('')
		setUploadProgress(null)
		try {
			const values = {
				name: form.name,
				code: form.code,
				parentId: form.parentId,
				businessCategoryRefs: form.businessCategoryRefs,
				sortOrder: Number(form.sortOrder),
				active: form.active,
				imageBlob: imageAsset?.blob || null,
				imageExtension: imageAsset?.extension || '',
				removeImage,
			}
			if (dialog.mode === 'edit') {
				const result = await updateMasterSubCategory(dialog.id, values, setUploadProgress)
				setFeedback(result.cleanupErrors.length
					? { type: 'error', text: `${form.name.trim()} was updated, but its previous image could not be removed from Storage.` }
					: { type: 'success', text: `${form.name.trim()} was updated.` })
			} else {
				await createMasterSubCategory(values, setUploadProgress)
				setFeedback({ type: 'success', text: `${form.name.trim()} was added.` })
			}
			setDialog(null)
			setLoading(true)
			setReload((current) => current + 1)
		} catch (error) {
			setFormError(error.message || 'The Master Sub Category could not be saved.')
		} finally {
			setSaving(false)
			setUploadProgress(null)
		}
	}

	async function applyActive(category, active) {
		setBusyId(category.id)
		setFeedback(null)
		setConfirmTarget(null)
		try {
			await setMasterSubCategoryActive(category.id, active)
			setFeedback({ type: 'success', text: `${category.name} was ${active ? 'activated' : 'deactivated'}.` })
			setLoading(true)
			setReload((current) => current + 1)
		} catch (error) {
			setFeedback({ type: 'error', text: error.message || 'The status could not be changed.' })
		} finally {
			setBusyId('')
		}
	}

	function requestToggle(category) {
		if (category.active === true) setConfirmTarget(category)
		else void applyActive(category, true)
	}

	function retryLoad() {
		setLoadError('')
		setLoading(true)
		setReload((current) => current + 1)
	}

	function parentLabel(category) {
		const parent = parentById.get(category.parentId)
		return parent?.name || category.parentName || category.parentId || 'Missing parent'
	}

	function mappingLabels(category) {
		return category.businessCategoryRefs.map((ref) => {
			const option = optionByKey.get(pairKey(ref.businessTypeId, ref.categoryId))
			return option ? `${option.businessTypeName} / ${option.name}` : `${ref.businessTypeId} / ${ref.categoryId}`
		})
	}

	function actionButtons(category) {
		return (
			<div className="store-actions">
				<button className="store-btn" onClick={() => openEdit(category)} type="button">Edit</button>
				<button className="store-btn" disabled={busyId === category.id} onClick={() => requestToggle(category)} type="button">
					{busyId === category.id ? 'Saving...' : category.active === true ? 'Deactivate' : 'Activate'}
				</button>
			</div>
		)
	}

	const summaryCards = [
		{ label: 'Total Master Sub Categories', value: counts.all },
		{ label: 'Active Sub Categories', value: counts.active },
		{ label: 'Inactive Sub Categories', value: counts.inactive },
		{ label: 'Without valid Business Category mappings', value: counts.unmapped },
	]
	const imageUrl = dialog?.mode === 'edit' ? categories.find((category) => category.id === dialog.id)?.imageUrl || '' : ''

	return (
		<section className="admin-master-categories admin-master-subcategories" aria-labelledby="master-subcategories-title">
			<div className="dashboard-heading">
				<div>
					<p className="eyebrow">DUKAN SETU / MASTER CATALOG</p>
					<h1 id="master-subcategories-title">Master Sub Categories</h1>
					<p className="dashboard-intro">Manage shared subcategories and link them to parent master categories and applicable business categories.</p>
				</div>
				<button className="store-btn store-btn-approve" disabled={loading || Boolean(loadError)} onClick={openCreate} type="button">Add Master Sub Category</button>
			</div>

			{feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role="status">{feedback.text}</p>}

			<div className="master-category-summary" aria-label="Master Sub Category summary">
				{summaryCards.map((card) => (
					<div className="master-category-summary-card" key={card.label}>
						<strong>{loading || loadError ? '—' : card.value}</strong>
						<span>{card.label}</span>
					</div>
				))}
			</div>

			<div className="business-type-toolbar master-category-toolbar">
				<div className="store-tabs" aria-label="Filter Master Sub Categories by status">
					{statusFilters.map((item) => (
						<button aria-pressed={statusFilter === item} className={statusFilter === item ? 'active' : ''} key={item} onClick={() => setStatusFilter(item)} type="button">
							{item === 'all' ? 'All' : item === 'active' ? 'Active' : 'Inactive'} ({counts[item]})
						</button>
					))}
				</div>
				<input aria-label="Search Master Sub Categories" className="store-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or code" type="search" value={search} />
				<div className="master-category-filters">
					<label>
						<span>Business Type</span>
						<select aria-label="Filter by Business Type" onChange={(event) => setBusinessTypeFilter(event.target.value)} value={businessTypeFilter}>
							<option value="">All Business Types</option>
							{businessTypes.map((type) => <option key={type.id} value={type.id}>{type.name || type.id}</option>)}
						</select>
					</label>
					<label>
						<span>Business Category</span>
						<select aria-label="Filter by Business Category" onChange={(event) => setBusinessCategoryFilter(event.target.value)} value={businessCategoryFilter}>
							<option value="">All Business Categories</option>
							{options.map((option) => {
								const key = pairKey(option.businessTypeId, option.categoryId)
								return <option key={key} value={key}>{option.name} · {option.businessTypeName}</option>
							})}
						</select>
					</label>
					<label>
						<span>Parent Master Category</span>
						<select aria-label="Filter by Parent Master Category" onChange={(event) => setParentFilter(event.target.value)} value={parentFilter}>
							<option value="">All Parent Categories</option>
							{parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name || parent.id}</option>)}
						</select>
					</label>
					<button className="store-btn master-category-clear" disabled={!businessTypeFilter && !businessCategoryFilter && !parentFilter && !search} onClick={() => {
						setBusinessTypeFilter('')
						setBusinessCategoryFilter('')
						setParentFilter('')
						setSearch('')
					}} type="button">Clear Filters</button>
				</div>
			</div>

			<p className="master-category-result-count" role="status">{visibleCategories.length} matching Master Sub {visibleCategories.length === 1 ? 'Category' : 'Categories'}</p>

			{loading ? (
				<p className="store-state" role="status">Loading Master Sub Categories...</p>
			) : loadError ? (
				<div className="store-state store-state-error" role="alert">
					<p>Could not load Master Sub Categories: {loadError}</p>
					<button className="store-btn" onClick={retryLoad} type="button">Retry</button>
				</div>
			) : categories.length === 0 ? (
				<p className="store-state">No Master Sub Categories have been added yet.</p>
			) : visibleCategories.length === 0 ? (
				<p className="store-state">No Master Sub Categories match the selected filters.</p>
			) : (
				<>
					<table className="business-type-table master-subcategory-table">
						<thead><tr><th>Image</th><th>Subcategory Name</th><th>Code / ID</th><th>Parent Master Category</th><th>Business Type / Categories</th><th>Level</th><th>Linked mappings</th><th>Status</th><th>Actions</th></tr></thead>
						<tbody>
							{visibleCategories.map((category) => (
								<tr key={category.id}>
									<td><SubCategoryThumbnail category={category} onPreview={setPreviewTarget} key={category.imageUrl || category.id} /></td>
									<td><strong>{category.name}</strong></td>
									<td><code>{category.id}</code></td>
									<td>{parentLabel(category)}</td>
									<td>{mappingLabels(category).length ? mappingLabels(category).join(', ') : 'Unmapped'}</td>
									<td>2</td>
									<td>{category.businessCategoryRefs.length}</td>
									<td><StatusBadge active={category.active === true} /></td>
									<td>{actionButtons(category)}</td>
								</tr>
							))}
						</tbody>
					</table>
					<ul className="business-type-cards master-subcategory-cards">
						{visibleCategories.map((category) => (
							<li key={category.id}>
								<div className="business-type-card-head"><div className="master-category-card-title"><SubCategoryThumbnail category={category} onPreview={setPreviewTarget} key={category.imageUrl || category.id} /><strong>{category.name}</strong></div><StatusBadge active={category.active === true} /></div>
								<p><code>{category.id}</code> <span>Level 2</span></p>
								<p>Hierarchy: {parentLabel(category)} / {category.name}</p>
								<p>{mappingLabels(category).join(', ') || 'No valid Business Category mappings'}</p>
								<p>{category.businessCategoryRefs.length} linked mapping{category.businessCategoryRefs.length === 1 ? '' : 's'}</p>
								{actionButtons(category)}
							</li>
						))}
					</ul>
				</>
			)}

			{dialog && (
				<div className="business-type-modal-backdrop" onClick={() => !saving && setDialog(null)} role="presentation">
					<form aria-labelledby="master-subcategory-form-title" aria-modal="true" className="business-type-modal master-category-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitForm} role="dialog">
						<h2 id="master-subcategory-form-title">{dialog.mode === 'edit' ? 'Edit Master Sub Category' : 'Add Master Sub Category'}</h2>
						{formError && <p className="store-feedback store-feedback-error" role="alert">{formError}</p>}
						{formNotice && <p className="master-subcategory-notice" role="status">{formNotice}</p>}

						<MasterCategoryImageField
							imageLabel="Subcategory image"
							imageNoun="subcategory"
							imageAsset={imageAsset}
							onChange={(asset) => { setImageAsset(asset); setRemoveImage(false) }}
							onRemove={() => { setImageAsset(null); setRemoveImage(true) }}
							savedUrl={imageUrl}
							showCompressedInCropper
							webpOnly
						/>
						{uploadProgress !== null && <p className="master-subcategory-upload-progress" role="status">Uploading image: {uploadProgress}%</p>}

						<label htmlFor="master-subcategory-name">Subcategory name</label>
						<input autoFocus id="master-subcategory-name" maxLength={80} onChange={(event) => {
							const name = event.target.value
							setForm((current) => ({ ...current, name, ...(dialog.mode === 'create' && !codeEdited ? { code: generateMasterSubCategoryCode(name) } : {}) }))
						}} required value={form.name} />

						<label htmlFor="master-subcategory-code">Subcategory code</label>
						<input id="master-subcategory-code" maxLength={50} onChange={(event) => {
							setCodeEdited(true)
							setForm((current) => ({ ...current, code: event.target.value }))
						}} pattern="[a-z0-9]+(_[a-z0-9]+)*" readOnly={dialog.mode === 'edit'} required title="Use lowercase letters, numbers and underscores." value={form.code} />

						<label htmlFor="master-subcategory-business-type">Business Type</label>
						<select id="master-subcategory-business-type" onChange={(event) => changeBusinessType(event.target.value)} required value={formBusinessTypeId}>
							<option value="">Select a Business Type</option>
							{formBusinessTypes.map((type) => <option disabled={type.active !== true} key={type.id} value={type.id}>{type.name || type.id}{type.active === true ? '' : ' · inactive (saved)'}</option>)}
						</select>

						<label htmlFor="master-subcategory-business-category">Business Category</label>
						<select disabled={!formBusinessTypeId} id="master-subcategory-business-category" onChange={(event) => changeBusinessCategory(event.target.value)} required value={formBusinessCategoryId}>
							<option value="">Select a Business Category</option>
							{formCategoriesForType.map((option) => <option disabled={option.active !== true} key={pairKey(option.businessTypeId, option.categoryId)} value={option.categoryId}>{option.name}{option.active === true ? '' : ' · inactive (saved)'}</option>)}
						</select>

						<label htmlFor="master-subcategory-master-category">Master Category</label>
						<select aria-label="Master Category" disabled={!formBusinessCategoryId} id="master-subcategory-master-category" onChange={(event) => changeMasterCategory(event.target.value)} required value={form.parentId}>
							<option value="">Select Master Category</option>
							{masterCategoryOptions.map((parent) => <option disabled={parent.active !== true} key={parent.id} value={parent.id}>{parent.name || parent.id}{parent.active === true ? '' : ' · inactive (saved)'}</option>)}
						</select>
						{!formBusinessTypeId ? <small className="master-category-hint">Choose a Business Type to load its active Business Categories.</small>
							: !formBusinessCategoryId ? <small className="master-category-hint">Choose a Business Category to find compatible Master Categories.</small>
								: masterCategoryOptions.length === 0 ? <small className="master-category-hint">No active Master Categories are mapped to this Business Category.</small>
									: null}

						<label htmlFor="master-subcategory-sort-order">Sort order</label>
						<input id="master-subcategory-sort-order" min="0" onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} required type="number" value={form.sortOrder} />

						<label htmlFor="master-subcategory-status">Status</label>
						<select id="master-subcategory-status" onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'active' }))} value={form.active ? 'active' : 'inactive'}>
							<option value="active">Active</option><option value="inactive">Inactive</option>
						</select>

						<div className="store-actions">
							<button className="store-btn" disabled={saving} onClick={() => setDialog(null)} type="button">Cancel</button>
							<button className="store-btn store-btn-approve" disabled={saving} type="submit">{saving ? uploadProgress === null ? 'Saving...' : `Uploading ${uploadProgress}%` : 'Save Subcategory'}</button>
						</div>
					</form>
				</div>
			)}

			{confirmTarget && (
				<div className="business-type-modal-backdrop" onClick={() => setConfirmTarget(null)} role="presentation">
					<div aria-labelledby="master-subcategory-confirm-title" aria-modal="true" className="business-type-modal" onClick={(event) => event.stopPropagation()} role="alertdialog">
						<h2 id="master-subcategory-confirm-title">Deactivate {confirmTarget.name}?</h2>
						<p>This subcategory will remain in the catalog with its mappings and image intact.</p>
						<div className="store-actions">
							<button className="store-btn" onClick={() => setConfirmTarget(null)} type="button">Cancel</button>
							<button className="store-btn store-btn-reject" onClick={() => applyActive(confirmTarget, false)} type="button">Deactivate</button>
						</div>
					</div>
				</div>
			)}

			{previewTarget && (
				<div className="business-type-modal-backdrop master-subcategory-preview-backdrop" onClick={() => setPreviewTarget(null)} role="presentation">
					<div aria-label={`${previewTarget.name} image preview`} aria-modal="true" className="master-subcategory-preview-dialog" onClick={(event) => event.stopPropagation()} role="dialog">
						<img alt={previewTarget.name} src={previewTarget.imageUrl} />
						<button className="store-btn" onClick={() => setPreviewTarget(null)} type="button">Close</button>
					</div>
				</div>
			)}
		</section>
	)
}