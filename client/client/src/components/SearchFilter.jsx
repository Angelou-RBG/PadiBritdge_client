import React, { useEffect, useState, useRef } from 'react';
import { getPostTypes, getTags, getTransactionTypes } from '../services/api';
import { useFilters } from '../context/FilterContext';

const HISTORY_SECTIONS = [
    { value: 'inventory-logs', label: 'Inventory Logs' },
    { value: 'order-rfqs', label: 'Allocation Requests' },
    { value: 'transactions', label: 'Transactions' },
];

const INVENTORY_FIELDS = [
    { value: '', label: 'All Fields' },
    { value: 'physical_sacks', label: 'Physical Sacks' },
    { value: 'allocated_sacks', label: 'Allocated Sacks' },
    { value: 'wholesale_price', label: 'Wholesale Price' },
];

const ORDER_STATUS_OPTIONS = [
    '',
    'Pending',
    'Approved',
    'Rejected',
    'Late',
    'Expired',
    'Fulfilled',
];

const ROLE_OPTIONS = [
    { value: '', label: 'All Roles' },
    { value: 'buyer', label: 'Buyer' },
    { value: 'miller', label: 'Miller' },
];

function buildFeedDefaults(contextFilters, initialFilters) {
    return {
        postType: initialFilters.postType || contextFilters.postType || '',
        tags: initialFilters.tags || contextFilters.tags || '',
        startDate: initialFilters.startDate || contextFilters.startDate || '',
        endDate: initialFilters.endDate || contextFilters.endDate || '',
        title: initialFilters.title || contextFilters.title || '',
    };
}

function buildHistoryDefaults(activeSection, initialFilters) {
    if (activeSection === 'order-rfqs') {
        return {
            section: activeSection,
            status: initialFilters.status || '',
            role: initialFilters.role || '',
            orderId: initialFilters.orderId || '',
            startDate: initialFilters.startDate || '',
            endDate: initialFilters.endDate || '',
        };
    }

    if (activeSection === 'transactions') {
        return {
            section: activeSection,
            transactionType: initialFilters.transactionType || '',
            referenceId: initialFilters.referenceId || '',
            customerId: initialFilters.customerId || '',
            startDate: initialFilters.startDate || '',
            endDate: initialFilters.endDate || '',
        };
    }

    return {
        section: activeSection,
        transactionType: initialFilters.transactionType || '',
        valueChanged: initialFilters.valueChanged || '',
        referenceId: initialFilters.referenceId || '',
        startDate: initialFilters.startDate || '',
        endDate: initialFilters.endDate || '',
    };
}

export default function SearchFilter({ onFilterChange, mode = 'feed', initialFilters = {}, activeSection = 'inventory-logs' }) {
    const { filters: contextFilters, globalTags } = useFilters();
    const [postTypes, setPostTypes] = useState([]);
    const [transactionTypes, setTransactionTypes] = useState([]);
    const [filters, setFilters] = useState(
        mode === 'feed'
            ? buildFeedDefaults(contextFilters, initialFilters)
            : buildHistoryDefaults(activeSection, initialFilters)
    );

    // shallow compare helper to avoid setting equivalent filter objects
    const shallowEqual = (a = {}, b = {}) => {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        for (let i = 0; i < aKeys.length; i++) {
            const k = aKeys[i];
            if (a[k] !== b[k]) return false;
        }
        return true;
    };

    // Apply defaults only on mount or when explicit initial/context filters change.
    const initializedRef = useRef(false);
    const prevInitialRef = useRef(initialFilters);
    const prevContextRef = useRef(contextFilters);
    const prevModeRef = useRef(mode);
    const prevSectionRef = useRef(activeSection);

    useEffect(() => {
        const next = mode === 'feed'
            ? buildFeedDefaults(contextFilters, initialFilters)
            : buildHistoryDefaults(activeSection, initialFilters);

        const initialChanged = !shallowEqual(prevInitialRef.current || {}, initialFilters || {});
        const contextChanged = !shallowEqual(prevContextRef.current || {}, contextFilters || {});
        const modeChanged = prevModeRef.current !== mode;
        const sectionChanged = prevSectionRef.current !== activeSection;

        const shouldApplyDefaults = !initializedRef.current || initialChanged || contextChanged || modeChanged || sectionChanged;

        if (shouldApplyDefaults && !shallowEqual(filters, next)) {
            setFilters(next);
        }

        initializedRef.current = true;
        prevInitialRef.current = initialFilters;
        prevContextRef.current = contextFilters;
        prevModeRef.current = mode;
        prevSectionRef.current = activeSection;
    // include filters so we compare against latest value when deciding to set
    }, [mode, contextFilters, initialFilters, activeSection, filters]);

    useEffect(() => {
        async function fetchData() {
            try {
                if (mode === 'history') {
                    if (activeSection === 'inventory-logs' || activeSection === 'transactions') {
                        const transactionTypesData = await getTransactionTypes();
                        setTransactionTypes(transactionTypesData.transactionTypes || []);
                    }
                    return;
                }

                const postTypesData = await getPostTypes();
                setPostTypes(postTypesData.postTypes || []);
            } catch (error) {
                console.error('Failed to fetch filter data:', error);
            }
        }

        fetchData();
    }, [mode, activeSection]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onFilterChange(filters);
    };

    const handleReset = () => {
        const resetFilters = mode === 'history'
            ? buildHistoryDefaults(activeSection, { section: activeSection })
            : {
                postType: '',
                tags: '',
                startDate: '',
                endDate: '',
                title: '',
            };

        setFilters(resetFilters);
        onFilterChange(resetFilters);
    };

    const currentSection = filters.section || activeSection;

    return (
        <div className="search-module">
            <h4>{mode === 'history' ? 'Search History' : 'Filter Feed'}</h4>
            <form onSubmit={handleSubmit}>
                {mode === 'history' ? (
                    <>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                            <label htmlFor="section" style={{ display: 'block', marginBottom: '0.25rem' }}>Table</label>
                            <select id="section" name="section" value={currentSection} onChange={handleChange} style={{ width: '100%' }}>
                                {HISTORY_SECTIONS.map(section => (
                                    <option key={section.value} value={section.value}>{section.label}</option>
                                ))}
                            </select>
                        </div>

                        {currentSection === 'inventory-logs' && (
                            <>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="transactionType" style={{ display: 'block', marginBottom: '0.25rem' }}>Transaction Type</label>
                                    <select id="transactionType" name="transactionType" value={filters.transactionType || ''} onChange={handleChange} style={{ width: '100%' }}>
                                        <option value="">All</option>
                                        {transactionTypes.map(type => (
                                            <option key={type.type_name} value={type.type_name}>{type.type_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="valueChanged" style={{ display: 'block', marginBottom: '0.25rem' }}>Changed Field</label>
                                    <select id="valueChanged" name="valueChanged" value={filters.valueChanged || ''} onChange={handleChange} style={{ width: '100%' }}>
                                        {INVENTORY_FIELDS.map(field => (
                                            <option key={field.value} value={field.value}>{field.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="referenceId" style={{ display: 'block', marginBottom: '0.25rem' }}>Reference ID</label>
                                    <input type="text" id="referenceId" name="referenceId" value={filters.referenceId || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="startDate" style={{ display: 'block', marginBottom: '0.25rem' }}>Start Date</label>
                                    <input type="date" id="startDate" name="startDate" value={filters.startDate || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="endDate" style={{ display: 'block', marginBottom: '0.25rem' }}>End Date</label>
                                    <input type="date" id="endDate" name="endDate" value={filters.endDate || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                            </>
                        )}

                        {currentSection === 'order-rfqs' && (
                            <>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="status" style={{ display: 'block', marginBottom: '0.25rem' }}>Status</label>
                                    <select id="status" name="status" value={filters.status || ''} onChange={handleChange} style={{ width: '100%' }}>
                                        {ORDER_STATUS_OPTIONS.map(status => (
                                            <option key={status || 'all'} value={status}>{status || 'All'}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="role" style={{ display: 'block', marginBottom: '0.25rem' }}>Role</label>
                                    <select id="role" name="role" value={filters.role || ''} onChange={handleChange} style={{ width: '100%' }}>
                                        {ROLE_OPTIONS.map(role => (
                                            <option key={role.value || 'all'} value={role.value}>{role.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="orderId" style={{ display: 'block', marginBottom: '0.25rem' }}>Order ID</label>
                                    <input type="number" min="1" step="1" id="orderId" name="orderId" value={filters.orderId || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="startDate" style={{ display: 'block', marginBottom: '0.25rem' }}>Start Date</label>
                                    <input type="date" id="startDate" name="startDate" value={filters.startDate || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="endDate" style={{ display: 'block', marginBottom: '0.25rem' }}>End Date</label>
                                    <input type="date" id="endDate" name="endDate" value={filters.endDate || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                            </>
                        )}

                        {currentSection === 'transactions' && (
                            <>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="transactionType" style={{ display: 'block', marginBottom: '0.25rem' }}>Transaction Type</label>
                                    <select id="transactionType" name="transactionType" value={filters.transactionType || ''} onChange={handleChange} style={{ width: '100%' }}>
                                        <option value="">All</option>
                                        {transactionTypes.map(type => (
                                            <option key={type.type_name} value={type.type_name}>{type.type_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="referenceId" style={{ display: 'block', marginBottom: '0.25rem' }}>Reference ID</label>
                                    <input type="text" id="referenceId" name="referenceId" value={filters.referenceId || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="customerId" style={{ display: 'block', marginBottom: '0.25rem' }}>Customer ID</label>
                                    <input type="text" id="customerId" name="customerId" value={filters.customerId || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                    <label htmlFor="startDate" style={{ display: 'block', marginBottom: '0.25rem' }}>Start Date</label>
                                    <input type="date" id="startDate" name="startDate" value={filters.startDate || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: '1rem' }}>
                                    <label htmlFor="endDate" style={{ display: 'block', marginBottom: '0.25rem' }}>End Date</label>
                                    <input type="date" id="endDate" name="endDate" value={filters.endDate || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                            <label htmlFor="postType" style={{ display: 'block', marginBottom: '0.25rem' }}>Post Type</label>
                            <select id="postType" name="postType" value={filters.postType || ''} onChange={handleChange} style={{ width: '100%' }}>
                                <option value="">All</option>
                                {postTypes.map(pt => (
                                    <option key={pt.id} value={pt.name}>{pt.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                            <label htmlFor="tags" style={{ display: 'block', marginBottom: '0.25rem' }}>Tags</label>
                            <select id="tags" name="tags" value={filters.tags || ''} onChange={handleChange} style={{ width: '100%' }}>
                                <option value="">All</option>
                                {(globalTags || []).map(tag => (
                                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                            <label htmlFor="startDate" style={{ display: 'block', marginBottom: '0.25rem' }}>Start Date</label>
                            <input type="date" id="startDate" name="startDate" value={filters.startDate || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label htmlFor="endDate" style={{ display: 'block', marginBottom: '0.25rem' }}>End Date</label>
                            <input type="date" id="endDate" name="endDate" value={filters.endDate || ''} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                        </div>
                    </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button type="submit">Filter</button>
                    <button type="button" onClick={handleReset}>Reset</button>
                </div>
            </form>
        </div>
    );
}