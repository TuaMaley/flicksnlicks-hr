/** Small validated images are stored in Employee.profilePhotoDataUrl.
 * For large-scale use, move storage to private object storage and retain an object key. */
export async function readEmployeePhoto(request:Request):Promise<string>{
 const type=request.headers.get('content-type')||'';
 if(!type.toLowerCase().startsWith('multipart/form-data'))throw new Error('Upload an image file');
 const form=await request.formData();
 const file=form.get('photo');
 if(!(file instanceof File))throw new Error('Choose a photo');
 if(file.size===0||file.size>150*1024)throw new Error('Photo must be 150 KB or smaller');
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use JPEG, PNG or WebP');
 const b=Buffer.from(await file.arrayBuffer());
 const jpeg=b.length>3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
 const png=b.length>8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=b.length>12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
 if(!((file.type==='image/jpeg'&&jpeg)||(file.type==='image/png'&&png)||(file.type==='image/webp'&&webp)))throw new Error('File content does not match image format');
 return `data:${file.type};base64,${b.toString('base64')}`;
}
