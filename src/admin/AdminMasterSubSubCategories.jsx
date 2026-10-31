import { useEffect, useState } from 'react'
import MasterCategoryImageField from '../shared/components/image-field/ImageCropEditor.jsx'
import {
	createMasterSubSubCategory,
	generateMasterSubSubCategoryCode,
	listMasterSubSubCategories,
	listSubSubCategoryOptions,
	setMasterSubSubCategoryActive,
	updateMasterSubSubCategory,
} from '../services/masterSubSubCategoryService'

const emptyForm = {
	name: '', code: '', businessTypeId: '', businessCategoryId: '', masterCategoryId: '', parentId: '',
	sortOrder: '10', active: true,
}
const statusFilters = ['all', 'active', 'inactive']

function pairKey(businessTypeId, categoryId) {
	return JSON.stringify([businessTypeId, categoryId])
}

function StatusBadge({ active }) {
	return <span className={`store-status store-status-${active ? 'approved' : 'rejected'}`}>{active ? 'Active' : 'Inactive'}</span>
}

function SearchableSelect({ id, label, value, options, onChange, disabled, placeholder }) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [activeIndex, setActiveIndex] = useState(0)
	const selected = options.find((option) => option.value === value)
	const visibleOptions = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

	function choose(option) {
		if (option.disabled) return
		onChange(option.value)
		setQuery(option.label)
		setOpen(false)
		setActiveIndex(0)
	}

	function handleKeyDown(event) {
		if (event.key === 'Escape') {
			setOpen(false)
			setQuery(selected?.label || '')
		} else if (event.key === 'ArrowDown') {
			event.preventDefault()
			setOpen(true)
			setActiveIndex((index) => Math.max(0, Math.min(index + 1, visibleOptions.length - 1)))
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			setActiveIndex((index) => Math.max(index - 1, 0))
		} else if (event.key === 'Enter' && open) {
			event.preventDefault()
			const option = visibleOptions[activeIndex]
			if (option) choose(option)
		}
	}

	return (
		<div className="master-sub-subcategory-search-select">
			<label htmlFor={id}>{label}</label>
			<div className="master-sub-subcategory-search-control">
				<input
					aria-autocomplete="list"
					aria-controls={`${id}-options`}
					aria-expanded={open}
					aria-label={label}
					autoComplete="off"
					disabled={disabled}
					id={id}
					onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); onChange('') }}
					onFocus={() => { setQuery(selected?.label || ''); setOpen(true) }}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					role="combobox"
					value={open ? query : selected?.label || ''}
				/>
				{open && !disabled && (
					<div className="master-sub-subcategory-search-options" id={`${id}-options`} role="listbox">
						{visibleOptions.length ? visibleOptions.map((option, index) => (
							<button
								aria-selected={option.value === value}
								className={index === activeIndex ? 'active' : ''}
								disabled={option.disabled}
								key={option.value}
								onClick={() => choose(option)}
								onMouseEnter={() => setActiveIndex(index)}
								role="option"
								type="button"
							>{option.label}</button>
						)) : <p>No matches</p>}
					</div>
				)}
			</div>
		</div>
	)
}

function SubSubCategoryThumbnail({ category, onPreview }) {
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

export default function AdminMasterSubSubCategories() {
	const [categories, setCategories] = useState([])
	const [businessTypes, setBusinessTypes] = useState([])
	const [businessCategories, setBusinessCategories] = useState([])
	const [masterCategories, setMasterCategories] = useState([])
	const [masterSubCategories, setMasterSubCategories] = useState([])
	const [loading, setLoading] = useState(true)
	const [loadError, setLoadError] = useState('')
	const [reload, setReload] = useState(0)

	const [search, setSearch] = useState('')
	const [statusFilter, setStatusFilter] = useState('all')
	const [businessTypeFilter, setBusinessTypeFilter] = useState('')
	const [businessCategoryFilter, setBusinessCategoryFilter] = useState('')
	const [masterCategoryFilter, setMasterCategoryFilter] = useState('')
	const [parentFilter, setParentFilter] = useState('')

	const [dialog, setDialog] = useState(null)
	const [form, setForm] = useState(emptyForm)
	const [codeEdited, setCodeEdited] = useState(false)
	const [formError, setFormError] = useState('')
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
		Promise.all([listMasterSubSubCategories(), listSubSubCategoryOptions()])
			.then(([subSubCategories, options]) => {
				if (!current) return
				setCategories(subSubCategories)
				setBusinessTypes(options.businessTypes)
				setBusinessCategories(options.businessCategories)
				setMasterCategories(options.masterCategories)
				setMasterSubCategories(options.masterSubCategories)
				setLoading(false)
			})
			.catch((error) => {
				if (!current) return
				setLoadError(error.message || 'Could not load Master Sub-Subcategories and catalog options.')
				setLoading(false)
			})
		return () => { current = false }
	}, [reload])

	const typeById = new Map(businessTypes.map((item) => [item.id, item]))
	const categoryByKey = new Map(businessCategories.map((item) => [pairKey(item.businessTypeId, item.id), item]))
	const masterCategoryById = new Map(masterCategories.map((item) => [item.id, item]))
	const subCategoryById = new Map(masterSubCategories.map((item) => [item.id, item]))
	const editingCategory = dialog?.mode === 'edit' ? categories.find((item) => item.id === dialog.id) : null
	const term = search.trim().toLocaleLowerCase()
	const selectedBusinessCategoryRef = businessCategoryFilter ? JSON.parse(businessCategoryFilter) : null

	function mappingIsValid(category) {
		const type = typeById.get(category.businessTypeId)
		const businessCategory = categoryByKey.get(pairKey(category.businessTypeId, category.businessCategoryId))
		const masterCategory = masterCategoryById.get(category.masterCategoryId)
		const subCategory = subCategoryById.get(category.parentId)
		const key = pairKey(category.businessTypeId, category.businessCategoryId)
		return Boolean(type && businessCategory && masterCategory && subCategory
			&& masterCategory.businessCategoryRefs?.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === key)
			&& subCategory.parentId === masterCategory.id
			&& subCategory.businessCategoryRefs?.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === key))
	}

	const matchingCategories = categories.filter((category) => {
		const matchesType = !businessTypeFilter || category.businessTypeId === businessTypeFilter
		const matchesBusinessCategory = !selectedBusinessCategoryRef || (category.businessTypeId === selectedBusinessCategoryRef[0]
			&& category.businessCategoryId === selectedBusinessCategoryRef[1])
		const matchesMasterCategory = !masterCategoryFilter || category.masterCategoryId === masterCategoryFilter
		const matchesParent = !parentFilter || category.parentId === parentFilter
		const matchesSearch = !term || [category.name, category.code].some((value) => String(value || '').toLocaleLowerCase().includes(term))
		return matchesType && matchesBusinessCategory && matchesMasterCategory && matchesParent && matchesSearch
	})
	const counts = {
		all: matchingCategories.length,
		active: matchingCategories.filter((category) => category.active === true).length,
		inactive: matchingCategories.filter((category) => category.active !== true).length,
		unmapped: matchingCategories.filter((category) => !mappingIsValid(category)).length,
	}
	const visibleCategories = matchingCategories.filter((category) => (
		statusFilter === 'all' || (statusFilter === 'active' ? category.active === true : category.active !== true)
	))
	const formBusinessTypes = businessTypes.filter((type) => type.active === true || type.id === editingCategory?.businessTypeId)
	const formBusinessCategories = businessCategories.filter((category) => category.businessTypeId === form.businessTypeId
		&& (category.active === true || (category.businessTypeId === editingCategory?.businessTypeId && category.id === editingCategory?.businessCategoryId)))
	const selectedPairKey = form.businessTypeId && form.businessCategoryId ? pairKey(form.businessTypeId, form.businessCategoryId) : ''
	const formMasterCategories = masterCategories.filter((category) => category.level === 1
		&& category.businessCategoryRefs?.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === selectedPairKey)
		&& (category.active === true || category.id === editingCategory?.masterCategoryId))
	const formMasterSubCategories = masterSubCategories.filter((category) => category.parentId === form.masterCategoryId
		&& category.businessCategoryRefs?.some((ref) => pairKey(ref.businessTypeId, ref.categoryId) === selectedPairKey)
		&& (category.active === true || category.id === editingCategory?.parentId))
	const imageUrl = editingCategory?.imageUrl || ''

	function resetFormState() {
		setFormError('')
		setImageAsset(null)
		setRemoveImage(false)
		setUploadProgress(null)
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
			businessTypeId: category.businessTypeId || '',
			businessCategoryId: category.businessCategoryId || category.businessCategoryRefs?.[0]?.categoryId || '',
			masterCategoryId: category.masterCategoryId || '',
			parentId: category.parentId || '',
			sortOrder: String(category.sortOrder ?? 0),
			active: category.active === true,
		})
		setCodeEdited(true)
		resetFormState()
		setDialog({ mode: 'edit', id: category.id })
	}

	function changeParentField(field, value) {
		setForm((current) => {
			if (field === 'businessTypeId') return { ...current, businessTypeId: value, businessCategoryId: '', masterCategoryId: '', parentId: '' }
			if (field === 'businessCategoryId') return { ...current, businessCategoryId: value, masterCategoryId: '', parentId: '' }
			if (field === 'masterCategoryId') return { ...current, masterCategoryId: value, parentId: '' }
			return { ...current, parentId: value }
		})
		setFormError('')
	}

	async function submitForm(event) {
		event.preventDefault()
		if (saving) return
		for (const [field, label] of [
			['businessTypeId', 'Business Type'], ['businessCategoryId', 'Business Category'],
			['masterCategoryId', 'Master Category'], ['parentId', 'Master Subcategory'],
		]) {
			if (!form[field]) {
				setFormError(`Select a ${label}.`)
				return
			}
		}
		setSaving(true)
		setFormError('')
		setUploadProgress(null)
		try {
			const values = {
				...form,
				sortOrder: Number(form.sortOrder),
				imageBlob: imageAsset?.blob || null,
				removeImage,
			}
			if (dialog.mode === 'edit') {
				const result = await updateMasterSubSubCategory(dialog.id, values, setUploadProgress)
				setFeedback(result.cleanupErrors.length
					? { type: 'error', text: `${form.name.trim()} was updated, but its previous image could not be removed from Storage.` }
					: { type: 'success', text: `${form.name.trim()} was updated.` })
			} else {
				await createMasterSubSubCategory(values, setUploadProgress)
				setFeedback({ type: 'success', text: `${form.name.trim()} was added.` })
			}
			setDialog(null)
			setLoading(true)
			setReload((current) => current + 1)
		} catch (error) {
			setFormError(error.message || 'The Master Sub-Subcategory could not be saved.')
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
			await setMasterSubSubCategoryActive(category.id, active)
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

	function businessContextLabel(category) {
		const type = typeById.get(category.businessTypeId)
		const businessCategory = categoryByKey.get(pairKey(category.businessTypeId, category.businessCategoryId))
		return `${type?.name || category.businessTypeId || 'Missing type'} / ${businessCategory?.name || category.businessCategoryId || 'Missing category'}`
	}

	function hierarchyLabel(category) {
		const masterCategory = masterCategoryById.get(category.masterCategoryId)
		const parent = subCategoryById.get(category.parentId)
		return [masterCategory?.name || category.masterCategoryId, parent?.name || category.parentName || category.parentId, category.name].filter(Boolean).join(' / ')
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
		{ label: 'Total Master Sub-Subcategories', value: counts.all },
		{ label: 'Active Sub-Subcategories', value: counts.active },
		{ label: 'Inactive Sub-Subcategories', value: counts.inactive },
		{ label: 'Missing or invalid hierarchy mappings', value: counts.unmapped },
	]
	const formTypeOptions = formBusinessTypes.map((type) => ({
		value: type.id,
		label: `${type.name || type.id}${type.active === true ? '' : ' · inactive (saved)'}`,
		disabled: type.active !== true && type.id !== editingCategory?.businessTypeId,
	}))
	const formBusinessCategoryOptions = formBusinessCategories.map((category) => ({
		value: category.id,
		label: `${category.name || category.id}${category.active === true ? '' : ' · inactive (saved)'}`,
		disabled: category.active !== true && (category.businessTypeId !== editingCategory?.businessTypeId || category.id !== editingCategory?.businessCategoryId),
	}))
	const formMasterCategoryOptions = formMasterCategories.map((category) => ({
		value: category.id,
		label: `${category.name || category.id}${category.active === true ? '' : ' · inactive (saved)'}`,
		disabled: category.active !== true && category.id !== editingCategory?.masterCategoryId,
	}))
	const formSubCategoryOptions = formMasterSubCategories.map((category) => ({
		value: category.id,
		label: `${category.name || category.id}${category.active === true ? '' : ' · inactive (saved)'}`,
		disabled: category.active !== true && category.id !== editingCategory?.parentId,
	}))

	return (
		<section className="admin-master-categories admin-master-subcategories admin-master-sub-subcategories" aria-labelledby="master-sub-subcategories-title">
			<div className="dashboard-heading">
				<div>
					<p className="eyebrow">DUKAN SETU / MASTER CATALOG</p>
					<h1 id="master-sub-subcategories-title">Master Sub-Subcategories</h1>
					<p className="dashboard-intro">Manage the next level of the shared Master Catalog hierarchy.</p>
				</div>
				<button className="store-btn store-btn-approve" disabled={loading || Boolean(loadError)} onClick={openCreate} type="button">Add Master Sub-Subcategory</button>
			</div>

			{feedback && <p className={`store-feedback store-feedback-${feedback.type}`} role="status">{feedback.text}</p>}

			<div className="master-category-summary" aria-label="Master Sub-Subcategory summary">
				{summaryCards.map((card) => (
					<div className="master-category-summary-card" key={card.label}>
						<strong>{loading || loadError ? '—' : card.value}</strong>
						<span>{card.label}</span>
					</div>
				))}
			</div>

			<div className="business-type-toolbar master-category-toolbar">
				<div className="store-tabs" aria-label="Filter Master Sub-Subcategories by status">
					{statusFilters.map((item) => (
						<button aria-pressed={statusFilter === item} className={statusFilter === item ? 'active' : ''} key={item} onClick={() => setStatusFilter(item)} type="button">
							{item === 'all' ? 'All' : item === 'active' ? 'Active' : 'Inactive'} ({counts[item]})
						</button>
					))}
				</div>
				<input aria-label="Search Master Sub-Subcategories" className="store-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or code" type="search" value={search} />
				<div className="master-category-filters">
					<label><span>Business Type</span><select aria-label="Filter by Business Type" onChange={(event) => setBusinessTypeFilter(event.target.value)} value={businessTypeFilter}><option value="">All Business Types</option>{businessTypes.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label>
					<label><span>Business Category</span><select aria-label="Filter by Business Category" onChange={(event) => setBusinessCategoryFilter(event.target.value)} value={businessCategoryFilter}><option value="">All Business Categories</option>{businessCategories.map((item) => <option key={pairKey(item.businessTypeId, item.id)} value={pairKey(item.businessTypeId, item.id)}>{item.name} · {item.businessTypeName}</option>)}</select></label>
					<label><span>Master Category</span><select aria-label="Filter by Master Category" onChange={(event) => setMasterCategoryFilter(event.target.value)} value={masterCategoryFilter}><option value="">All Master Categories</option>{masterCategories.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label>
					<label><span>Master Subcategory</span><select aria-label="Filter by Master Subcategory" onChange={(event) => setParentFilter(event.target.value)} value={parentFilter}><option value="">All Master Subcategories</option>{masterSubCategories.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></label>
					<button className="store-btn master-category-clear" disabled={!businessTypeFilter && !businessCategoryFilter && !masterCategoryFilter && !parentFilter && !search} onClick={() => {
						setBusinessTypeFilter('')
						setBusinessCategoryFilter('')
						setMasterCategoryFilter('')
						setParentFilter('')
						setSearch('')
					}} type="button">Clear Filters</button>
				</div>
			</div>

			<p className="master-category-result-count" role="status">{visibleCategories.length} matching Master Sub-Subcategor{visibleCategories.length === 1 ? 'y' : 'ies'}</p>

			{loading ? (
				<p className="store-state" role="status">Loading Master Sub-Subcategories...</p>
			) : loadError ? (
				<div className="store-state store-state-error" role="alert"><p>Could not load Master Sub-Subcategories: {loadError}</p><button className="store-btn" onClick={retryLoad} type="button">Retry</button></div>
			) : categories.length === 0 ? (
				<p className="store-state">No Master Sub-Subcategories have been added yet.</p>
			) : visibleCategories.length === 0 ? (
				<p className="store-state">No Master Sub-Subcategories match the selected filters.</p>
			) : (
				<>
					<table className="business-type-table master-subcategory-table">
						<thead><tr><th>Image</th><th>Name</th><th>Code / ID</th><th>Parent Master Subcategory</th><th>Hierarchy</th><th>Linked business context</th><th>Status</th><th>Actions</th></tr></thead>
						<tbody>{visibleCategories.map((category) => (
							<tr key={category.id}>
								<td><SubSubCategoryThumbnail category={category} key={category.imageUrl || category.id} onPreview={setPreviewTarget} /></td>
								<td><strong>{category.name}</strong></td>
								<td><code>{category.id}</code></td>
								<td>{subCategoryById.get(category.parentId)?.name || category.parentName || category.parentId || 'Missing parent'}</td>
								<td>{hierarchyLabel(category)}</td>
								<td>{businessContextLabel(category)}</td>
								<td><StatusBadge active={category.active === true} /></td>
								<td>{actionButtons(category)}</td>
							</tr>
						))}</tbody>
					</table>
					<ul className="business-type-cards master-subcategory-cards">
						{visibleCategories.map((category) => (
							<li key={category.id}>
								<div className="business-type-card-head"><div className="master-category-card-title"><SubSubCategoryThumbnail category={category} key={category.imageUrl || category.id} onPreview={setPreviewTarget} /><strong>{category.name}</strong></div><StatusBadge active={category.active === true} /></div>
								<p><code>{category.id}</code> <span>Level 3</span></p>
								<p>Parent: {subCategoryById.get(category.parentId)?.name || category.parentName || category.parentId || 'Missing parent'}</p>
								<p>Hierarchy: {hierarchyLabel(category)}</p>
								<p>{businessContextLabel(category)}</p>
								{actionButtons(category)}
							</li>
						))}
					</ul>
				</>
			)}

			{dialog && (
				<div className="business-type-modal-backdrop" onClick={() => !saving && setDialog(null)} role="presentation">
					<form aria-labelledby="master-sub-subcategory-form-title" aria-modal="true" className="business-type-modal master-category-modal master-sub-subcategory-modal" onClick={(event) => event.stopPropagation()} onSubmit={submitForm} role="dialog">
						<h2 id="master-sub-subcategory-form-title">{dialog.mode === 'edit' ? 'Edit Master Sub-Subcategory' : 'Add Master Sub-Subcategory'}</h2>
						{formError && <p className="store-feedback store-feedback-error" role="alert">{formError}</p>}
						<MasterCategoryImageField imageLabel="Sub-Subcategory image" imageNoun="Sub-Subcategory" imageAsset={imageAsset} onChange={(asset) => { setImageAsset(asset); setRemoveImage(false) }} onRemove={() => { setImageAsset(null); setRemoveImage(true) }} savedUrl={imageUrl} showCompressedInCropper webpOnly />
						{uploadProgress !== null && <p className="master-subcategory-upload-progress" role="status">Uploading image: {uploadProgress}%</p>}

						<label htmlFor="master-sub-subcategory-name">Sub-Subcategory name</label>
						<input autoFocus id="master-sub-subcategory-name" maxLength={80} onChange={(event) => {
							const name = event.target.value
							setForm((current) => ({ ...current, name, ...(dialog.mode === 'create' && !codeEdited ? { code: generateMasterSubSubCategoryCode(name) } : {}) }))
						}} required value={form.name} />

						<label htmlFor="master-sub-subcategory-code">Sub-Subcategory code</label>
						<input id="master-sub-subcategory-code" maxLength={50} onChange={(event) => { setCodeEdited(true); setForm((current) => ({ ...current, code: event.target.value })) }} pattern="[a-z0-9]+(_[a-z0-9]+)*" readOnly={dialog.mode === 'edit'} required title="Use lowercase letters, numbers and underscores." value={form.code} />

						<SearchableSelect id="master-sub-subcategory-business-type" label="Business Type" value={form.businessTypeId} options={formTypeOptions} onChange={(value) => changeParentField('businessTypeId', value)} placeholder="Search Business Types" />
						<SearchableSelect id="master-sub-subcategory-business-category" label="Business Category" value={form.businessCategoryId} options={formBusinessCategoryOptions} onChange={(value) => changeParentField('businessCategoryId', value)} disabled={!form.businessTypeId} placeholder="Search Business Categories" />
						<SearchableSelect id="master-sub-subcategory-master-category" label="Master Category" value={form.masterCategoryId} options={formMasterCategoryOptions} onChange={(value) => changeParentField('masterCategoryId', value)} disabled={!form.businessCategoryId} placeholder="Search Master Categories" />
						<SearchableSelect id="master-sub-subcategory-parent" label="Master Subcategory" value={form.parentId} options={formSubCategoryOptions} onChange={(value) => changeParentField('parentId', value)} disabled={!form.masterCategoryId} placeholder="Search Master Subcategories" />
						{!form.businessTypeId ? <small className="master-category-hint">Choose a Business Type to load its active Business Categories.</small>
							: !form.businessCategoryId ? <small className="master-category-hint">Choose a Business Category to find compatible Master Categories.</small>
								: !form.masterCategoryId ? <small className="master-category-hint">Choose a Master Category to load its valid Master Subcategories.</small>
									: formSubCategoryOptions.length === 0 ? <small className="master-category-hint">No active Master Subcategories belong to this hierarchy.</small> : null}

						<label htmlFor="master-sub-subcategory-sort-order">Sort order</label>
						<input id="master-sub-subcategory-sort-order" min="0" onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} required type="number" value={form.sortOrder} />

						<label htmlFor="master-sub-subcategory-status">Status</label>
						<select id="master-sub-subcategory-status" onChange={(event) => setForm((current) => ({ ...current, active: event.target.value === 'active' }))} value={form.active ? 'active' : 'inactive'}><option value="active">Active</option><option value="inactive">Inactive</option></select>

						<div className="store-actions">
							<button className="store-btn" disabled={saving} onClick={() => setDialog(null)} type="button">Cancel</button>
							<button className="store-btn store-btn-approve" disabled={saving} type="submit">{saving ? uploadProgress === null ? 'Saving...' : `Uploading ${uploadProgress}%` : 'Save Sub-Subcategory'}</button>
						</div>
					</form>
				</div>
			)}

			{confirmTarget && (
				<div className="business-type-modal-backdrop" onClick={() => setConfirmTarget(null)} role="presentation">
					<div aria-labelledby="master-sub-subcategory-confirm-title" aria-modal="true" className="business-type-modal" onClick={(event) => event.stopPropagation()} role="alertdialog">
						<h2 id="master-sub-subcategory-confirm-title">Deactivate {confirmTarget.name}?</h2>
						<p>This Sub-Subcategory and its image will remain in the catalog. Descendant records are not deleted.</p>
						<div className="store-actions"><button className="store-btn" onClick={() => setConfirmTarget(null)} type="button">Cancel</button><button className="store-btn store-btn-reject" onClick={() => applyActive(confirmTarget, false)} type="button">Deactivate</button></div>
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