import React, { createContext, useContext, useState } from 'react';

const FilterContext = createContext();

export function useFilters() {
    return useContext(FilterContext);
}

export function FilterProvider({ children }) {
    const [filters, setFilters] = useState({});

    const value = {
        filters,
        setFilters,
    };

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}