import React, { createContext, useContext, useState, useMemo } from 'react';

const FilterContext = createContext();

export function useFilters() {
    return useContext(FilterContext);
}

export function FilterProvider({ children }) {
    const [filters, setFilters] = useState({});

    const value = useMemo(() => ({
        filters,
        setFilters,
    }), [filters, setFilters]);

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}