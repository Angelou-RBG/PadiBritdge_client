import React, { useState, useEffect } from 'react';
import { getPostTypes, getTags } from '../services/api';
import { useFilters } from '../context/FilterContext';

export default function SearchFilter({ onFilterChange }) {
    const { filters: contextFilters } = useFilters();
    const [postTypes, setPostTypes] = useState([]);
    const [tags, setTags] = useState([]);
    const [filters, setFilters] = useState({
        postType: contextFilters.postType || '',
        tags: contextFilters.tags || '',
        startDate: contextFilters.startDate || '',
        endDate: contextFilters.endDate || '',
    });

    useEffect(() => {
        async function fetchData() {
            try {
                const [postTypesData, tagsData] = await Promise.all([getPostTypes(), getTags()]);
                setPostTypes(postTypesData.postTypes || []);
                setTags(tagsData.tags || []);
            } catch (error) {
                console.error('Failed to fetch filter data:', error);
            }
        }
        fetchData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onFilterChange(filters);
    };

    const handleReset = () => {
        const resetFilters = {
            postType: '',
            tags: '',
            startDate: '',
            endDate: '',
        };
        setFilters(resetFilters);
        onFilterChange(resetFilters);
    };

    return (
        <div className="search-module">
            <h4>Filter Feed</h4>
            <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label htmlFor="postType" style={{ display: 'block', marginBottom: '0.25rem' }}>Post Type</label>
                    <select id="postType" name="postType" value={filters.postType} onChange={handleChange} style={{ width: '100%' }}>
                        <option value="">All</option>
                        {postTypes.map(pt => (
                            <option key={pt.id} value={pt.name}>{pt.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label htmlFor="tags" style={{ display: 'block', marginBottom: '0.25rem' }}>Tags</label>
                    <select id="tags" name="tags" value={filters.tags} onChange={handleChange} style={{ width: '100%' }}>
                        <option value="">All</option>
                        {tags.map(tag => (
                            <option key={tag.id} value={tag.name}>{tag.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label htmlFor="startDate" style={{ display: 'block', marginBottom: '0.25rem' }}>Start Date</label>
                    <input type="date" id="startDate" name="startDate" value={filters.startDate} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="endDate" style={{ display: 'block', marginBottom: '0.25rem' }}>End Date</label>
                    <input type="date" id="endDate" name="endDate" value={filters.endDate} onChange={handleChange} style={{ width: 'calc(100% - 8px)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button type="submit">Filter</button>
                    <button type="button" onClick={handleReset}>Reset</button>
                </div>
            </form>
        </div>
    );
}