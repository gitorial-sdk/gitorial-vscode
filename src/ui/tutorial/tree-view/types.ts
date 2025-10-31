/**
 * @param path The relative path to the file
 * @param status The file status code
 */
export type FileStatus = {
  path   : string;
  status : FileStatusCode;
};

/**
 * The status symbol (M = Modified, D = Deleted, U = New)
 */
export type FileStatusCode = 'M' | 'D' | 'U';
