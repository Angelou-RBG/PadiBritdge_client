import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getTags } from '../services/api';

const FilterContext = createContext();

export function useFilters() {
    return useContext(FilterContext);
}

export function FilterProvider({ children }) {
    const [filters, setFilters] = useState({});
    const [globalTags, setGlobalTags] = useState([]);

    useEffect(() => {
        let isActive = true;
        getTags().then(data => {
            if (isActive && data?.tags) {
                setGlobalTags(data.tags);
            }
        }).catch(console.error);
        return () => { isActive = false; };
    }, []);

    const value = useMemo(() => ({
        filters,
        setFilters,
        globalTags,
    }), [filters, setFilters, globalTags]);

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}